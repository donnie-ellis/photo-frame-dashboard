// Shopping feed: items and stores from frame-bridge, with the js/data.js mock as the fallback.
// Items are replaced whole. Check-off is optimistic and rolls back with a toast. Nothing else on
// the list is writable.
import * as api from '../api/frame-bridge';
import type { ShoppingItem, Store } from '../api/frame-bridge';
import * as events from '../api/events';
import { toast } from '../ui';
import { Freshness, watchHealth, type FeedStatus } from './feed.svelte';

class ShoppingStore {
  items = $state.raw<ShoppingItem[]>(window.DATA.groceries);
  stores = $state.raw<Store[]>(window.DATA.stores);
  pending = $state.raw<ReadonlySet<string>>(new Set());

  #fresh = new Freshness();
  #active = false;
  #inflight = new Map<string, number>();
  #unsubs: Array<() => void> = [];

  get status(): FeedStatus {
    return this.#fresh.status;
  }

  get updatedAt(): Date | null {
    return this.#fresh.updatedAt;
  }

  async load(): Promise<void> {
    try {
      const list = await api.getShoppingList();
      this.stores = list.stores;
      this.#fresh.ok();
      this.#setItems(list.items);
    } catch {
      this.#fresh.fail();
    }
  }

  /** Check an item off, or put it back. */
  async setDone(id: string, done: boolean): Promise<void> {
    const prev = this.items.find((i) => i.id === id);
    if (!prev) return;
    this.#setItems(this.items.map((i) => (i.id === id ? { ...i, done } : i)));
    if (this.status === 'mock') return;
    this.#mark(id, 1);
    try {
      const saved = await api.setShoppingItem(id, { done });
      this.#setItems(this.items.map((i) => (i.id === id ? saved : i)));
      this.#fresh.clear();
    } catch {
      this.#setItems(this.items.map((i) => (i.id === id ? prev : i)));
      toast(`Couldn’t update ${prev.name} · it may be offline`, { tone: 'error', icon: 'bolt' });
    } finally {
      this.#mark(id, -1);
    }
  }

  activate(): void {
    if (this.#active) return;
    this.#active = true;
    void this.load();
    events.start();
    this.#unsubs = [
      events.on('shopping', () => void this.load()),
      events.onPoll(() => void this.load()),
      watchHealth('shopping', (f) => this.#fresh.applyHealth(f)),
    ];
  }

  deactivate(): void {
    if (!this.#active) return;
    this.#active = false;
    this.#unsubs.forEach((u) => u());
    this.#unsubs = [];
    events.stop();
  }

  #setItems(items: ShoppingItem[]): void {
    this.items = items;
  }

  #mark(id: string, delta: 1 | -1): void {
    const n = (this.#inflight.get(id) ?? 0) + delta;
    const next = new Set(this.pending);
    if (n > 0) {
      this.#inflight.set(id, n);
      next.add(id);
    } else {
      this.#inflight.delete(id);
      next.delete(id);
    }
    this.pending = next;
  }
}

export const shopping = new ShoppingStore();

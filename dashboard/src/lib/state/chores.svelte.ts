// Chores feed: Reminders chores from frame-bridge, with the js/data.js mock as the fallback. The
// list is replaced whole on each fetch. Check-off is optimistic and rolls back with a toast.
// toggle() is the one entry point for a chore tap (this view and the Today card).
import * as api from '../api/frame-bridge';
import type { Chore } from '../api/frame-bridge';
import * as events from '../api/events';
import { toast } from '../ui';
import { Freshness, watchHealth, type FeedStatus } from './feed.svelte';

export type ChoreItem = Omit<Chore, 'due'> & { due?: Date };
export type ChoreState = 'overdue' | 'today' | 'done' | 'undated';

export function dayStart(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

const toItem = (c: Chore): ChoreItem => ({ ...c, due: c.due ? new Date(c.due) : undefined });

/** An all-day chore is overdue only once its day has passed. A timed one when its time has. */
export function choreState(c: ChoreItem, now: Date): ChoreState {
  if (c.done) return 'done';
  if (!c.due) return 'undated';
  if (c.allDay) return dayStart(c.due) < dayStart(now) ? 'overdue' : 'today';
  return +c.due < +now ? 'overdue' : 'today';
}

/** Not done and due: overdue or due today (undated chores don't count). */
export function isDueNow(c: ChoreItem, now: Date): boolean {
  const st = choreState(c, now);
  return st === 'overdue' || st === 'today';
}

const RANK: Record<ChoreState, number> = { overdue: 0, today: 1, undated: 2, done: 3 };

/** Overdue, then today (all-day first, then by time), then undated, then done. */
export function compareChores(a: ChoreItem, b: ChoreItem, now: Date): number {
  const sa = choreState(a, now);
  const sb = choreState(b, now);
  if (sa !== sb) return RANK[sa] - RANK[sb];
  if (sa === 'today' && !!a.allDay !== !!b.allDay) return a.allDay ? -1 : 1;
  if ((sa === 'overdue' || sa === 'today') && a.due && b.due && +a.due !== +b.due) return +a.due - +b.due;
  return a.title.localeCompare(b.title);
}

class ChoresStore {
  list = $state.raw<ChoreItem[]>(window.DATA.chores);
  pending = $state.raw<ReadonlySet<string>>(new Set());

  #fresh = new Freshness();
  #active = false;
  #hooked = false;
  #day = dayStart(new Date());
  #inflight = new Map<string, number>();
  #unsubs: Array<() => void> = [];

  get status(): FeedStatus {
    return this.#fresh.status;
  }

  get updatedAt(): Date | null {
    return this.#fresh.updatedAt;
  }

  async load(): Promise<void> {
    this.#day = dayStart(new Date());
    try {
      const res = await api.listChores();
      this.list = res.chores.map(toItem);
      this.#fresh.ok();
    } catch {
      // Keep what we have (mock on first load).
      this.#fresh.fail();
    }
  }

  /**
   * Check a chore off, or put it back. Resolves to the id the chore has afterwards: the PATCH
   * response can carry a different id (a repeating reminder moves to its next occurrence). Null on failure.
   */
  async setDone(id: string, done: boolean): Promise<string | null> {
    const prev = this.list.find((c) => c.id === id);
    if (!prev) return null;
    this.list = this.list.map((c) => (c.id === id ? { ...c, done } : c));
    if (this.status === 'mock') return id;
    this.#mark(id, 1);
    try {
      const saved = toItem(await api.setChore(id, { done }));
      this.list = this.list.map((c) => (c.id === id ? saved : c));
      this.#fresh.clear();
      return saved.id;
    } catch {
      this.list = this.list.map((c) => (c.id === id ? prev : c));
      toast(`Couldn’t update ${prev.title} · it may be offline`, { tone: 'error', icon: 'bolt' });
      return null;
    } finally {
      this.#mark(id, -1);
    }
  }

  /** A tap on a chore: check it off with an undo toast, or quietly put a done one back. */
  toggle(id: string): void {
    const c = this.list.find((x) => x.id === id);
    if (!c || this.pending.has(id)) return;
    if (c.done) {
      void this.setDone(id, false);
      return;
    }
    const saved = this.setDone(id, true);
    toast(`${c.title} done`, {
      icon: 'check',
      undo: () => {
        void saved.then((rid) => {
          if (rid) void this.setDone(rid, false);
        });
      },
    });
  }

  activate(): void {
    if (this.#active) return;
    this.#active = true;
    void this.load();
    events.start();
    this.#unsubs = [
      events.on('chores', () => void this.load()),
      events.onPoll(() => void this.load()),
      watchHealth('chores', (f) => this.#fresh.applyHealth(f)),
    ];
    if (!this.#hooked) {
      this.#hooked = true;
      // "Due by the end of today" moves with the date, so a new day needs a new fetch.
      window.App.on('minute', () => {
        if (this.#active && dayStart(new Date()) !== this.#day) void this.load();
      });
    }
  }

  deactivate(): void {
    if (!this.#active) return;
    this.#active = false;
    this.#unsubs.forEach((u) => u());
    this.#unsubs = [];
    events.stop();
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

export const chores = new ChoresStore();

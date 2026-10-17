// Upcoming chores: the read-only 6 days after today, from GET /api/chores/upcoming. Only fetched
// while the Chores view shows Week. The list is replaced whole on each fetch; mock until then.
import * as api from '../api/frame-bridge';
import type { UpcomingChore } from '../api/frame-bridge';
import * as events from '../api/events';
import { Freshness, watchHealth, type FeedStatus } from './feed.svelte';
import { dayStart } from './chores.svelte';

export type UpcomingItem = Omit<UpcomingChore, 'due'> & { due: Date };

const DAY = 86400000;
const toItem = (c: UpcomingChore): UpcomingItem => ({ ...c, due: new Date(c.due) });

class UpcomingStore {
  list = $state.raw<UpcomingItem[]>(window.DATA.upcomingChores);

  #fresh = new Freshness();
  #active = false;
  #hooked = false;
  #day = dayStart(new Date());
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
      const res = await api.listUpcomingChores();
      this.list = res.chores.map(toItem);
      this.#fresh.ok();
    } catch {
      // Keep what we have (mock on first load).
      this.#fresh.fail();
    }
  }

  /** Chores for each of the days 1..6 after `now`, all-day first, then by time, then title. */
  byDay(now: Date): Map<number, UpcomingItem[]> {
    const today = dayStart(now);
    const out = new Map<number, UpcomingItem[]>();
    for (const c of this.list) {
      // round() absorbs the 23 and 25 hour days at a DST change.
      const i = Math.round((dayStart(c.due) - today) / DAY);
      if (i < 1 || i > 6) continue;
      const arr = out.get(i);
      if (arr) arr.push(c);
      else out.set(i, [c]);
    }
    out.forEach((arr) =>
      arr.sort(
        (a, b) =>
          Number(!!b.allDay) - Number(!!a.allDay) || +a.due - +b.due || a.title.localeCompare(b.title),
      ),
    );
    return out;
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
      // The window rolls with the date, so a new day needs a new fetch.
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
}

export const upcoming = new UpcomingStore();

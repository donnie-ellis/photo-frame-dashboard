// Calendar feed: events from frame-bridge, with the js/data.js mock as the fallback. The list is
// replaced whole on each fetch, and written through to window.DATA.events for the vanilla view.
import * as api from '../api/frame-bridge';
import type { ApiEvent } from '../api/frame-bridge';
import * as events from '../api/events';
import { Freshness, watchHealth, writeLegacy, type FeedStatus } from './feed.svelte';

export type CalEvent = Omit<ApiEvent, 'start' | 'end'> & { start: Date; end: Date };

// Release 1 window: the calendar view pages by day, week and month, and the spec allows 120 days.
const DAYS_BACK = 35;
const DAYS_AHEAD = 84;

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

class CalendarStore {
  events = $state.raw<CalEvent[]>(window.DATA.events);

  #fresh = new Freshness();
  #active = false;
  #hooked = false;
  #day = dayStart(new Date()).getTime();
  #unsubs: Array<() => void> = [];

  get status(): FeedStatus {
    return this.#fresh.status;
  }

  get updatedAt(): Date | null {
    return this.#fresh.updatedAt;
  }

  async load(): Promise<void> {
    const today = dayStart(new Date());
    this.#day = today.getTime();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - DAYS_BACK);
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + DAYS_AHEAD);
    try {
      const list = await api.listEvents(from, to);
      this.events = list.map((e) => ({ ...e, start: new Date(e.start), end: new Date(e.end) }));
      this.#fresh.ok();
      writeLegacy('events', this.events);
    } catch {
      // Keep what we have (mock on first load).
      this.#fresh.fail();
    }
  }

  /** The demo drawer swapped or edited the mock events in place: pick that up. */
  syncLegacy(): void {
    this.events = [...window.DATA.events];
  }

  activate(): void {
    if (this.#active) return;
    this.#active = true;
    void this.load();
    events.start();
    this.#unsubs = [
      events.on('calendar', () => void this.load()),
      events.onPoll(() => void this.load()),
      watchHealth('calendar', (f) => this.#fresh.applyHealth(f)),
    ];
    if (!this.#hooked) {
      this.#hooked = true;
      // The fetch window is anchored on today, so a new day needs a new fetch.
      window.App.on('minute', () => {
        if (this.#active && dayStart(new Date()).getTime() !== this.#day) void this.load();
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

export const calendar = new CalendarStore();

// Day summary from frame-bridge. Display only, no mock, no stale state: any failure (503 = none
// for today) clears it, because old text can name a cancelled event.
import * as api from '../api/frame-bridge';
import type { DaySummary } from '../api/frame-bridge';
import * as events from '../api/events';

class SummaryStore {
  data = $state.raw<DaySummary | null>(null);

  #active = false;
  #loadedDay = '';
  #unsubs: Array<() => void> = [];

  /** The text, only if it is for `dayKey` (local YYYY-MM-DD). */
  textFor(dayKey: string): string | null {
    const d = this.data;
    return d && d.date === dayKey && d.text ? d.text : null;
  }

  async load(): Promise<void> {
    try {
      this.data = await api.getDaySummary();
    } catch {
      this.data = null;
    }
  }

  /** Re-fetch when the local day rolls over. */
  dayChanged(dayKey: string): void {
    if (!this.#active) return;
    if (this.#loadedDay && this.#loadedDay !== dayKey) void this.load();
    this.#loadedDay = dayKey;
  }

  activate(): void {
    if (this.#active) return;
    this.#active = true;
    void this.load();
    events.start();
    this.#unsubs = [events.on('summary', () => void this.load()), events.onPoll(() => void this.load())];
  }

  deactivate(): void {
    if (!this.#active) return;
    this.#active = false;
    this.#unsubs.forEach((u) => u());
    this.#unsubs = [];
    events.stop();
  }
}

export const summary = new SummaryStore();

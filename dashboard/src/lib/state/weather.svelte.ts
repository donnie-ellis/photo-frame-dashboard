// Weather feed from frame-bridge, with the js/data.js mock as the fallback. The 48-hour arrays are
// kept as delivered (index 0 is local midnight today), and written through to window.DATA.weather.
import * as api from '../api/frame-bridge';
import type { Weather } from '../api/frame-bridge';
import * as events from '../api/events';
import { Freshness, watchHealth, writeLegacy, type FeedStatus } from './feed.svelte';

export type WeatherData = Omit<Weather, 'start'> & { start?: Date };

class WeatherStore {
  data = $state.raw<WeatherData>(window.DATA.weather);

  #fresh = new Freshness();
  #active = false;
  #unsubs: Array<() => void> = [];

  get status(): FeedStatus {
    return this.#fresh.status;
  }

  get updatedAt(): Date | null {
    return this.#fresh.updatedAt;
  }

  async load(): Promise<void> {
    try {
      const w = await api.getWeather();
      this.data = { ...w, start: new Date(w.start) };
      this.#fresh.ok();
      writeLegacy('weather', this.data);
    } catch {
      this.#fresh.fail();
    }
  }

  activate(): void {
    if (this.#active) return;
    this.#active = true;
    void this.load();
    events.start();
    this.#unsubs = [
      events.on('weather', () => void this.load()),
      events.onPoll(() => void this.load()),
      watchHealth('weather', (f) => this.#fresh.applyHealth(f)),
    ];
  }

  deactivate(): void {
    if (!this.#active) return;
    this.#active = false;
    this.#unsubs.forEach((u) => u());
    this.#unsubs = [];
    events.stop();
  }
}

export const weather = new WeatherStore();

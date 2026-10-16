// Sonos now-playing from frame-bridge. Display only, no mock: without a live feed Today shows photos.
import * as api from '../api/frame-bridge';
import type { NowPlaying } from '../api/frame-bridge';
import * as events from '../api/events';
import { Freshness, watchHealth, type FeedStatus } from './feed.svelte';

class NowPlayingStore {
  data = $state.raw<NowPlaying | null>(null);

  #fresh = new Freshness();
  #active = false;
  #unsubs: Array<() => void> = [];

  get status(): FeedStatus {
    return this.#fresh.status;
  }

  /** Music is playing with a title, and the feed is fresh. Paused, TV and line-in show photos. */
  get showing(): boolean {
    return this.status === 'live' && this.data?.state === 'playing' && !!this.data.title;
  }

  /** Per-track cache-buster for the art URL. */
  get artKey(): string {
    const d = this.data;
    return [d?.title ?? '', d?.artist ?? '', d?.album ?? ''].join('|');
  }

  async load(): Promise<void> {
    try {
      this.data = await api.getNowPlaying();
      this.#fresh.ok();
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
      events.on('nowplaying', (np: NowPlaying) => {
        this.data = np;
        this.#fresh.ok();
      }),
      events.onPoll(() => void this.load()),
      watchHealth('sonos', (f) => this.#fresh.applyHealth(f)),
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

export const nowPlaying = new NowPlayingStore();

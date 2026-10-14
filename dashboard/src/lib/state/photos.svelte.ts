// Photos feed from frame-bridge, with the js/data.js mock as the fallback. Live photos have an id
// (the image is served by the bridge) and no seed. Written through to window.DATA.photos.
import * as api from '../api/frame-bridge';
import type { Photo } from '../api/frame-bridge';
import * as events from '../api/events';
import { Freshness, watchHealth, writeLegacy, type FeedStatus } from './feed.svelte';

/** A live photo, or a mock one (which has `seed` and `from` instead of `id`). */
export type PhotoItem = Partial<Photo> & { o: 'l' | 'p'; date: string; tag: string; seed?: string; from?: string };

class PhotosStore {
  items = $state.raw<PhotoItem[]>(window.DATA.photos);

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
      this.items = await api.listPhotos();
      this.#fresh.ok();
      writeLegacy('photos', this.items);
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
      events.on('photos', () => void this.load()),
      events.onPoll(() => void this.load()),
      watchHealth('photos', (f) => this.#fresh.applyHealth(f)),
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

export const photos = new PhotosStore();

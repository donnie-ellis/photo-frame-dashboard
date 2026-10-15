// Photos feed from frame-bridge, with the js/data.js mock as the fallback. Live photos have an id
// (the image is served by the bridge) and no seed.
import * as api from '../api/frame-bridge';
import type { Photo } from '../api/frame-bridge';
import * as events from '../api/events';
import { Freshness, watchHealth, type FeedStatus } from './feed.svelte';

/** A live photo, or a mock one (which has `seed` and `from` instead of `id`). */
export type PhotoItem = Partial<Photo> & { o: 'l' | 'p'; date: string; tag: string; seed?: string; from?: string };

export interface PhotoMeta {
  date: string;
  monthYear: string;
  kicker: string;
  onThisDay: boolean;
  place: string;
}

/** Image URL sized to how it is shown: 'half' for tiles and polaroids, 'full' for full-bleed. */
export function photoSrc(p: PhotoItem, size: 'full' | 'half'): string {
  if (p.id && !p.seed) return api.photoUrl(p.id, size);
  let w = p.o === 'p' ? 800 : 1600;
  let h = p.o === 'p' ? 1200 : 1000;
  if (size === 'half') {
    w = Math.round(w / 2);
    h = Math.round(h / 2);
  }
  return window.App.img(p.seed ?? '', w, h);
}

export function photoMeta(p: PhotoItem): PhotoMeta {
  const App = window.App;
  const a = p.date.split('-');
  const d = new Date(+a[0], +a[1] - 1, +a[2]);
  const now = App.now();
  const years = now.getFullYear() - d.getFullYear();
  const onThisDay = d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
  const kicker = onThisDay
    ? years + (years === 1 ? ' year' : ' years') + ' ago today'
    : years > 0
      ? years + (years === 1 ? ' year ago' : ' years ago')
      : 'This year';
  return {
    date: App.fmt.month(d) + ' ' + d.getDate() + ', ' + d.getFullYear(),
    monthYear: App.fmt.month(d) + ' ' + d.getFullYear(),
    kicker,
    onThisDay,
    place: p.place ?? '',
  };
}

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

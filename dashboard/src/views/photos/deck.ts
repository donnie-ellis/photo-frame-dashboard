// The slideshow's choice of what to show next: no DOM. Each slideshow has its own queue and history.
import { photoMeta, type PhotoItem } from '../../lib/state/photos.svelte';

export type Layout = 'auto' | 'cover' | 'pair' | 'collage' | 'polaroid';

export interface Slide {
  /** Stable for the life of the slide, for the keyed each. */
  key: number;
  layout: Exclude<Layout, 'auto'>;
  photos: PhotoItem[];
  /** Ken Burns drift (signed fractions of the box) and polaroid tilt, chosen once. */
  dx: number;
  dy: number;
  rot: number;
}

const HISTORY = 20;

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createDeck(getList: () => PhotoItem[]) {
  let queue: PhotoItem[] = [];
  let list: PhotoItem[] | null = null;
  let count = 0;
  let key = 0;
  const history: Slide[] = [];
  let current: Slide | null = null;

  function refill(l: PhotoItem[]) {
    const q: PhotoItem[] = [];
    l.forEach((p) => {
      q.push(p);
      if (p.fav) q.push(p);
    });
    // On-this-day photos always come first in a fresh cycle.
    shuffle(q).sort((a, b) => (photoMeta(b).onThisDay ? 1 : 0) - (photoMeta(a).onThisDay ? 1 : 0));
    queue = q;
  }

  function take(pred?: (p: PhotoItem) => boolean): PhotoItem | null {
    const l = getList();
    // The live feed replaces the list whole: drop queued photos from the old one.
    if (list !== l) {
      list = l;
      queue = [];
    }
    if (!queue.length) refill(l);
    for (let i = 0; i < queue.length; i++) if (!pred || pred(queue[i])) return queue.splice(i, 1)[0];
    return null;
  }

  function pick(want: Layout): Slide | null {
    const n = count++;
    let first = take();
    if (!first) return null;
    const l = getList();
    const sibling = (pred: (p: PhotoItem) => boolean) => take(pred) ?? l.find((x) => x !== first && pred(x));
    let layout = want;
    if (layout === 'auto') {
      if (first.o === 'p') layout = l.some((x) => x !== first && x.tag === first!.tag) ? 'pair' : 'polaroid';
      else layout = n % 5 === 3 ? 'collage' : n % 5 === 4 ? 'polaroid' : 'cover';
    }
    let ps: PhotoItem[] = [first];
    if (layout === 'pair') {
      if (first.o !== 'p') {
        first = sibling((x) => x.o === 'p') ?? first;
        ps = [first];
      }
      const f = first;
      const b = sibling((x) => x !== f && x.o === 'p' && x.tag === f.tag) ?? sibling((x) => x !== f && x.o === 'p');
      if (b) ps.push(b);
    }
    if (layout === 'collage') {
      const b = sibling((x) => x !== first);
      if (b) ps.push(b);
      const c = sibling((x) => !ps.includes(x));
      if (c) ps.push(c);
    }
    // Too few photos for the layout: fall back to a single.
    if ((layout === 'pair' && ps.length < 2) || (layout === 'collage' && ps.length < 3)) layout = 'cover';
    return {
      key: ++key,
      layout,
      photos: ps,
      dx: (Math.random() > 0.5 ? 1 : -1) * (0.01 + Math.random() * 0.025),
      dy: (Math.random() > 0.5 ? 1 : -1) * (0.005 + Math.random() * 0.015),
      rot: Math.round((Math.random() * 5 - 2.5) * 10) / 10,
    };
  }

  return {
    get current() {
      return current;
    },
    next(layout: Layout): Slide | null {
      const s = pick(layout);
      if (!s) return null;
      if (current) {
        history.push(current);
        if (history.length > HISTORY) history.shift();
      }
      current = s;
      return s;
    },
    prev(): Slide | null {
      const s = history.pop();
      if (!s) return null;
      current = s;
      return s;
    },
  };
}

// People from frame-bridge's config, with the neutral js/data.js placeholders as the fallback.
// The wire has id, name, color and an optional night colour; rgb and ink are derived here.
import * as api from '../api/frame-bridge';
import type { ApiPerson } from '../api/frame-bridge';
import * as events from '../api/events';
import type { Person } from '../legacy.svelte';
import { writeLegacy } from './feed.svelte';

type RGB = [number, number, number];

const toRgb = (hex: string): RGB => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];
const rgbOf = (hex: string) => toRgb(hex).join(' ');
const isLight = ([r, g, b]: RGB) => (r * 299 + g * 587 + b * 114) / 1000 >= 128;
const inkOf = (hex: string, dark: string) => (isLight(toRgb(hex)) ? dark : '#ffffff');

/** Same hue, saturation capped and lightness lifted into a band that reads on the night background. */
function nightOf(hex: string): string {
  const [r, g, b] = toRgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let l = (max + min) / 2;
  let s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + 6) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  s = Math.min(s, 0.62);
  l = Math.min(0.68, Math.max(0.54, l + 0.12));
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs((h % 2) - 1));
  const m = l - c / 2;
  const [r1, g1, b1] =
    h < 1 ? [c, x, 0] : h < 2 ? [x, c, 0] : h < 3 ? [0, c, x] : h < 4 ? [0, x, c] : h < 5 ? [x, 0, c] : [c, 0, x];
  return '#' + [r1, g1, b1].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('');
}

function toPerson(p: ApiPerson): Person {
  const night = p.night ?? nightOf(p.color);
  return {
    id: p.id,
    name: p.name,
    color: p.color,
    rgb: rgbOf(p.color),
    ink: inkOf(p.color, '#111111'),
    night: { color: night, rgb: rgbOf(night), ink: inkOf(night, '#1a0907') },
  };
}

class PeopleStore {
  list = $state.raw<Person[]>(window.DATA.people);

  #active = false;
  #unsub: (() => void) | null = null;

  async load(): Promise<void> {
    try {
      const ps = (await api.listPeople()).map(toPerson);
      writeLegacy('people', ps);
    } catch {
      // Keep what we have: placeholders on first load, the live list after that.
    }
  }

  activate(): void {
    if (this.#active) return;
    this.#active = true;
    void this.load();
    events.start();
    this.#unsub = events.onPoll(() => void this.load());
  }

  deactivate(): void {
    if (!this.#active) return;
    this.#active = false;
    this.#unsub?.();
    this.#unsub = null;
    events.stop();
  }
}

export const people = new PeopleStore();

// Vanilla code and many Svelte views read window.DATA.people directly. Routing it through the
// signal makes those reads reactive, so every view updates when people load with no per-component
// changes. Vanilla code still sees a plain array.
Object.defineProperty(window.DATA, 'people', {
  get: () => people.list,
  set: (v: Person[]) => {
    people.list = v;
  },
  configurable: true,
  enumerable: true,
});

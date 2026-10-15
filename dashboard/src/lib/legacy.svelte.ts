// Bridge to the vanilla app in js/. Shrinks as views are converted; delete it with the last one.
import { mount, type Component } from 'svelte';
import type { CalEvent } from './state/calendar.svelte';
import type { ShoppingItem, Store } from './api/frame-bridge';
import type { PhotoItem } from './state/photos.svelte';
import type { WeatherData } from './state/weather.svelte';
import { calendar } from './state/calendar.svelte';
import { shopping } from './state/shopping.svelte';
import { weather } from './state/weather.svelte';
import { photos } from './state/photos.svelte';

interface LegacyView {
  show(el: HTMLElement, opts: Record<string, unknown>): void;
  hide?(): void;
  resume?(el: HTMLElement): void;
}

export interface Person {
  id: string;
  name: string;
  color: string;
  rgb: string;
  ink: string;
  night?: { color: string; rgb: string; ink: string };
}

export interface HourSlot {
  h: number;
  t: number;
  c: string;
  /** Chance of rain, percent. */
  p: number;
  label: string;
}

export interface WeatherNow {
  temp: number;
  cond: string;
  label: string;
  hi: number;
  lo: number;
  summary: string;
  advice: string;
}

// Only what the bridge and the converted views use. js/app.js has the rest.
interface LegacyApp {
  mode: string;
  img(seed: string, w: number, h: number): string;
  register(name: string, view: LegacyView): void;
  on(event: string, fn: (arg?: any) => void): void;
  off(event: string, fn: (arg?: any) => void): void;
  emit(event: string, arg?: unknown): void;
  go(name: string): void;
  now(): Date;
  dayStart(d: Date): Date;
  addDays(d: Date, n: number): Date;
  fmt: {
    time(d: Date, ampm?: boolean): string;
    ampm(d: Date): string;
    day(d: Date): string;
    dayShort(d: Date): string;
    month(d: Date): string;
    monthShort(d: Date): string;
    rel(d: Date): string;
    range(a: Date, b: Date): string;
    mins(n: number): string;
  };
  person(id: string): Person;
  pstyle(p: Person | string): string;
  isFamily(e: CalEvent): boolean;
  evColor(e: CalEvent): Person;
  sameDay(a: Date, b: Date): boolean;
  events(): CalEvent[];
  timedOn(day: Date, pid?: string): CalEvent[];
  allDayOn(day: Date, pid?: string): CalEvent[];
  leaveBy(e: CalEvent): Date;
  nextEvent(): CalEvent | null;
  findEvent(id: string): CalEvent | undefined;
  weatherNow(): WeatherNow;
  hourly(count: number): HourSlot[];
  setShoppingDone(id: string, done: boolean): void;
  /** True once the feed has loaded from the bridge (also while it is stale). Mock until then. */
  isLive(feed: 'calendar' | 'shopping' | 'weather' | 'photos'): boolean;
}

// The slices of js/data.js that live feeds replace in place.
export interface LegacyData {
  events: CalEvent[];
  groceries: ShoppingItem[];
  stores: Store[];
  catOrder: Record<string, string[]>;
  weather: WeatherData;
  photos: PhotoItem[];
  people: Person[];
  family: Person;
}

declare global {
  interface Window {
    App: LegacyApp;
    DATA: LegacyData;
  }
}

/** Gives the vanilla views the two things they need from the Svelte stores. */
export function exposeFeeds(): void {
  const stores = { calendar, shopping, weather, photos };
  window.App.setShoppingDone = (id, done) => void shopping.setDone(id, done);
  window.App.isLive = (feed) => stores[feed].status !== 'mock';
  // An unlabelled 'data' comes from vanilla code editing the mock lists in place. The stores emit
  // with a property name, so this never loops.
  window.App.on('data', (prop) => {
    if (prop !== undefined) return;
    shopping.syncLegacy();
    calendar.syncLegacy();
  });
}

export interface ViewProps {
  /** False while the view is hidden: stop timers and animations. */
  active: boolean;
}

/**
 * Registers a Svelte component as a view in the vanilla router. The router calls show() on every
 * visit and again after data changes; Svelte updates itself, so only the first call mounts.
 */
export function registerView(name: string, component: Component<ViewProps>): void {
  const props = $state<ViewProps>({ active: false });
  let mounted = false;
  window.App.register(name, {
    show(el) {
      if (!mounted) {
        el.innerHTML = '';
        mount(component, { target: el, props });
        mounted = true;
      }
      props.active = true;
    },
    hide() {
      props.active = false;
    },
    resume() {
      props.active = true;
    },
  });
}

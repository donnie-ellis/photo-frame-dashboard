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

// Only what the bridge uses. js/app.js has the rest.
interface LegacyApp {
  register(name: string, view: LegacyView): void;
  on(event: string, fn: (arg?: unknown) => void): void;
  emit(event: string, arg?: unknown): void;
  now(): Date;
  dayStart(d: Date): Date;
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

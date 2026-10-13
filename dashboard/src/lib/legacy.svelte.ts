// Bridge to the vanilla app in js/. Shrinks as views are converted; delete it with the last one.
import { mount, type Component } from 'svelte';

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
}

declare global {
  interface Window {
    App: LegacyApp;
  }
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

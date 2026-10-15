// The event detail sheet, shared by the calendar view and Today. Mounted once, on first use.
import { mount } from 'svelte';
import type { CalEvent } from '../../lib/state/calendar.svelte';
import EventSheet from './EventSheet.svelte';

let current = $state.raw<CalEvent | null>(null);
let mounted = false;

export function openEvent(e: CalEvent | undefined): void {
  if (!e) return;
  if (!mounted) {
    mounted = true;
    mount(EventSheet, { target: document.getElementById('stage') ?? document.body });
    // Ambient and night mode cover the stage: don't leave a sheet behind them.
    window.App.on('mode', closeEvent);
  }
  current = e;
}

export function closeEvent(): void {
  current = null;
}

export function openedEvent(): CalEvent | null {
  return current;
}

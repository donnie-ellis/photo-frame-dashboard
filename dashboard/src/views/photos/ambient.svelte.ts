// The ambient screen's stage. js/views/ambient.js still builds the overlay and the clock; this
// mounts the photos (or the album art while Sonos plays) into its stage once it exists.
import { mount } from 'svelte';
import AmbientStage from './AmbientStage.svelte';

export function mountAmbientSlideshow(): void {
  const App = window.App;
  const props = $state({ active: false });
  // Registered after ambient.js's own 'ready' handler, so .amb-stage is there.
  App.on('ready', () => {
    const target = document.querySelector('#ambient .amb-stage');
    if (!target) return;
    props.active = App.mode === 'ambient';
    mount(AmbientStage, { target, props });
  });
  App.on('mode', (m: string) => (props.active = m === 'ambient'));
}

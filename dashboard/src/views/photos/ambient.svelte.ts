// The ambient screen's slideshow. js/views/ambient.js still builds the overlay and the clock; this
// mounts the photos into its stage once it exists.
import { mount } from 'svelte';
import Slideshow from './Slideshow.svelte';

export function mountAmbientSlideshow(): void {
  const App = window.App;
  const props = $state({ active: false, layout: 'cover' as const, captions: false, interval: 14000 });
  // Registered after ambient.js's own 'ready' handler, so .amb-stage is there.
  App.on('ready', () => {
    const target = document.querySelector('#ambient .amb-stage');
    if (!target) return;
    props.active = App.mode === 'ambient';
    mount(Slideshow, { target, props });
  });
  App.on('mode', (m: string) => (props.active = m === 'ambient'));
}

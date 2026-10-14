// Entry point. The vanilla app loads first and defines window.App; converted Svelte views then
// register with its router (see lib/legacy.svelte.ts). Both run before App.start on DOMContentLoaded.
import '../js/main.js';
import { mount } from 'svelte';
import { Toaster } from './lib/ui';
import { registerView } from './lib/legacy.svelte';
import Lights from './views/lights/Lights.svelte';

registerView('lights', Lights);
mount(Toaster, { target: document.getElementById('stage')! });

// Long-press fires contextmenu on Android. There's no menu to show on the frame, and letting it
// through can cancel the pointer mid-gesture (App.hold: rail clock, unlock, water valve).
document.addEventListener('contextmenu', (e) => e.preventDefault());

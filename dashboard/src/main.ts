// Entry point. The vanilla app loads first and defines window.App; converted Svelte views then
// register with its router (see lib/legacy.svelte.ts). Both run before App.start on DOMContentLoaded.
import '../js/main.js';

// Long-press fires contextmenu on Android. There's no menu to show on the frame, and letting it
// through can cancel the pointer mid-gesture (App.hold: rail clock, unlock, water valve).
document.addEventListener('contextmenu', (e) => e.preventDefault());

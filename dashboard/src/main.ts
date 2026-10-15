// Entry point. The vanilla app loads first and defines window.App; converted Svelte views then
// register with its router (see lib/legacy.svelte.ts). Both run before App.start on DOMContentLoaded.
import '../js/main.js';
import { mount } from 'svelte';
import { Toaster } from './lib/ui';
import { registerView, exposeFeeds } from './lib/legacy.svelte';
import { calendar } from './lib/state/calendar.svelte';
import { shopping } from './lib/state/shopping.svelte';
import { weather } from './lib/state/weather.svelte';
import { photos } from './lib/state/photos.svelte';
import Calendar from './views/calendar/Calendar.svelte';
import Control from './views/control/Control.svelte';
import Shopping from './views/shopping/Shopping.svelte';
import Today from './views/today/Today.svelte';
import Photos from './views/photos/Photos.svelte';
import { mountAmbientSlideshow } from './views/photos/ambient.svelte';
import { startUpdateWatch } from './lib/update-watch';

registerView('home', Today);
registerView('control', Control);
registerView('calendar', Calendar);
registerView('shopping', Shopping);
registerView('photos', Photos);
mountAmbientSlideshow();
exposeFeeds();
// These feeds feed several views (and the ambient screen), so they stay live for the page lifetime.
for (const feed of [calendar, shopping, weather, photos]) feed.activate();
mount(Toaster, { target: document.getElementById('stage')! });
startUpdateWatch();

// Long-press fires contextmenu on Android. There's no menu to show on the frame, and letting it
// through can cancel the pointer mid-gesture (App.hold: rail clock, unlock, water valve).
document.addEventListener('contextmenu', (e) => e.preventDefault());

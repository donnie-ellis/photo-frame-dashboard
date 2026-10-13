// Entry for the dev-only gallery (kit.html). Loads the icon set the kit shares with the vanilla app.
import { mount } from 'svelte';
import '../../js/icons.js';
import { Toaster } from '../lib/ui';
import Gallery from './Gallery.svelte';

const stage = document.getElementById('stage')!;
mount(Gallery, { target: document.getElementById('kit')! });
mount(Toaster, { target: stage });

<script lang="ts">
  // Photos: full-bleed slideshow with layout modes. Tap left/right for prev/next, the middle for
  // stronger captions.
  import type { ViewProps } from '../../lib/legacy.svelte';
  import { photos } from '../../lib/state/photos.svelte';
  import { Icon, Segmented, pressable, toast } from '../../lib/ui';
  import type { Layout } from './deck';
  import Slideshow from './Slideshow.svelte';

  let { active }: ViewProps = $props();

  const LAYOUTS: { value: Layout; label: string }[] = [
    { value: 'auto', label: 'Auto' },
    { value: 'cover', label: 'Cover' },
    { value: 'pair', label: 'Pair' },
    { value: 'collage', label: 'Collage' },
    { value: 'polaroid', label: 'Polaroid' },
  ];

  let layout = $state<Layout>('auto');
  let loud = $state(false);
  let show: Slideshow;
  let current = $state.raw<{ fav?: boolean } | null>(null);
  let fav = $state(false);

  // The bridge can't write favourites, so the button only exists on the mock photos.
  function toggleFav() {
    if (!current) return;
    fav = !fav;
    current.fav = fav;
    toast(fav ? 'Added to favourites · it’ll show up more often' : 'Removed from favourites', { icon: 'heart', ms: 2500 });
  }
</script>

<div class="pv">
  <Slideshow
    bind:this={show}
    {active}
    {layout}
    {loud}
    interval={15000}
    onchange={(s) => {
      current = s.photos[0];
      fav = !!current.fav;
    }} />
  <button class="pv-zone pv-zone--l" aria-label="Previous" onclick={() => show.prev()}></button>
  <button class="pv-zone pv-zone--c" aria-label="Show details" onclick={() => (loud = !loud)}></button>
  <button class="pv-zone pv-zone--r" aria-label="Next" onclick={() => show.next()}></button>
  <div class="pv-top"><Segmented options={LAYOUTS} bind:value={layout} tone="glass" /></div>
  <div class="pv-bottom">
    <button class="pv-btn" aria-label="Previous" onclick={() => show.prev()} {@attach pressable}><Icon name="left" size={30} /></button>
    {#if photos.status === 'mock'}
      <button class="pv-btn pv-btn--fav" class:on={fav} onclick={toggleFav} {@attach pressable}>
        <Icon name="heart" size={30} /><span>Favourite</span>
      </button>
    {/if}
    <button class="pv-btn" aria-label="Next" onclick={() => show.next()} {@attach pressable}><Icon name="right" size={30} /></button>
  </div>
</div>

<style>
  .pv { position: absolute; top: 0; right: 0; bottom: 0; left: 0; background: var(--photo-gap); color: var(--photo-on); overflow: hidden; }
  .pv-zone { position: absolute; top: 90px; bottom: 110px; z-index: 3; }
  .pv-zone--l { left: 0; width: 22%; }
  .pv-zone--c { left: 22%; width: 56%; }
  .pv-zone--r { right: 0; width: 22%; }
  .pv-top { position: absolute; top: 20px; right: 20px; z-index: 4; }
  .pv-bottom { position: absolute; right: 24px; bottom: 28px; z-index: 4; display: flex; gap: 10px; }
  .pv-btn {
    height: var(--tap); min-width: var(--tap); padding: 0 17px; border-radius: 999px;
    display: inline-flex; align-items: center; justify-content: center; gap: 10px;
    background: var(--photo-glass); color: var(--photo-on);
    font-size: 17px; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    transition: transform 0.15s var(--ease);
  }
  .pv-btn:global(.is-pressed) { transform: scale(0.92); transition-duration: 0s; }
  .pv-btn--fav { padding: 0 24px 0 20px; }
  .pv-btn--fav.on { background: var(--photo-fav); }
  .pv-btn--fav.on :global(.i) { fill: currentColor; }
</style>

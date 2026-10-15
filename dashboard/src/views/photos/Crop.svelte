<script lang="ts">
  // One cover-cropped photo. With a focus box the crop is moved so the subject stays in frame; without
  // one it keeps the default crop. With `drift` the wrapper is the Ken Burns element, and the drift is
  // clamped to keep the focus in view.
  import type { PhotoItem } from '../../lib/state/photos.svelte';
  import { focusCrop } from './focus';

  let { photo, src, drift }: { photo: PhotoItem; src: string; drift?: { dx: number; dy: number } } = $props();

  let bw = $state(0);
  let bh = $state(0);
  let ar = $state(0);

  const crop = $derived(photo.focus && bw && bh && ar ? focusCrop(photo.focus, ar, bw / bh, drift) : null);
  const broken = (e: Event) => (e.currentTarget as HTMLElement).classList.add('is-broken');
</script>

<div
  class="crop"
  class:ss-kb={drift}
  bind:clientWidth={bw}
  bind:clientHeight={bh}
  style:--dx={drift ? (crop ? crop.dx : drift.dx) * 100 + '%' : undefined}
  style:--dy={drift ? (crop ? crop.dy : drift.dy) * 100 + '%' : undefined}>
  <img
    class="ss-img"
    {src}
    alt=""
    style:object-position={crop?.pos}
    onload={(e) => (ar = (e.currentTarget as HTMLImageElement).naturalWidth / (e.currentTarget as HTMLImageElement).naturalHeight)}
    onerror={broken} />
</div>

<style>
  .crop { display: block; width: 100%; height: 100%; }
  .ss-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; }
  .ss-img:global(.is-broken) { visibility: hidden; }

  .ss-kb { position: absolute; top: 0; right: 0; bottom: 0; left: 0; overflow: hidden; background: var(--photo-fill); animation: ss-kb var(--ss-dur) linear both; }
  :global(.paused) .ss-kb { animation-play-state: paused; }
  @keyframes ss-kb {
    to { transform: scale(1.08) translate(var(--dx), var(--dy)); }
  }
</style>

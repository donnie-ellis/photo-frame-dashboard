<script lang="ts">
  // The ambient screen's stage: the photo slideshow, replaced by the album art while Sonos plays.
  // The slideshow stays mounted (paused) so it resumes where it was. Today owns the nowPlaying
  // subscription, so this only reads it. The backdrop is the art shrunk to 4x4 and stretched over
  // the stage (a cheap blur with no filter), then dimmed. It is built before its fade starts.
  import { onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  import { nowPlaying } from '../../lib/state/nowplaying.svelte';
  import { nowPlayingArtUrl } from '../../lib/api/frame-bridge';
  import { Icon } from '../../lib/ui';
  import Slideshow from './Slideshow.svelte';

  let { active }: { active: boolean } = $props();

  const FADE_MS = 700;

  const playing = $derived(active && nowPlaying.showing);
  const np = $derived(nowPlaying.data);
  const key = $derived(nowPlaying.artKey);
  // Art that failed to load, per track.
  let failedKey = $state('');
  // Art that has finished loading, per track. It fades in so a slow JPEG never paints row by row.
  let loadedKey = $state('');
  const showArt = $derived(!!np?.art && failedKey !== key);

  let washes = $state.raw<{ key: string; canvas: HTMLCanvasElement }[]>([]);
  let img: HTMLImageElement | undefined;
  let raf = 0;
  let building = '';

  function cancel() {
    if (img) img.onload = img.onerror = null;
    img = undefined;
    cancelAnimationFrame(raf);
    building = '';
  }

  function build(k: string) {
    building = k;
    const el = new Image();
    img = el;
    el.onerror = () => {
      if (building === k) failedKey = k;
    };
    el.onload = () => {
      if (building !== k) return;
      let src: CanvasImageSource = el;
      let w = el.naturalWidth;
      let h = el.naturalHeight;
      while (w > 4 || h > 4) {
        w = Math.max(4, Math.ceil(w / 4));
        h = Math.max(4, Math.ceil(h / 4));
        const c = document.createElement('canvas');
        c.width = w;
        c.height = h;
        c.getContext('2d')!.drawImage(src, 0, 0, w, h);
        src = c;
      }
      const canvas = src as HTMLCanvasElement;
      const ctx = canvas.getContext('2d')!;
      ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--photo-dim');
      ctx.fillRect(0, 0, w, h);
      raf = requestAnimationFrame(() => {
        if (building !== k) return;
        washes = [...washes.slice(-1), { key: k, canvas }];
      });
    };
    el.src = nowPlayingArtUrl(k, 'half');
  }

  $effect(() => {
    const k = key;
    if (!playing) {
      cancel();
      washes = [];
      return;
    }
    if (!np?.art || failedKey === k || washes.some((w) => w.key === k) || building === k) return;
    cancel();
    build(k);
  });

  onDestroy(cancel);

  const mountCanvas = (canvas: HTMLCanvasElement) => (el: HTMLElement) => {
    el.appendChild(canvas);
  };
</script>

<Slideshow active={active && !playing} layout="cover" captions={false} interval={14000} />

{#if playing}
  <div class="ams" transition:fade={{ duration: FADE_MS }}>
    {#each washes as w (w.key)}
      <div
        class="ams-wash"
        in:fade={{ duration: FADE_MS }}
        onintroend={() => (washes = washes.slice(-1))}
        {@attach mountCanvas(w.canvas)}
      ></div>
    {/each}
    <div class="ams-art">
      <span class="ams-ph"><Icon name="music" size={96} /></span>
      {#if showArt}
        <img
          class:loaded={loadedKey === key}
          src={nowPlayingArtUrl(key, 'half')}
          alt=""
          decoding="async"
          onload={() => (loadedKey = key)}
          onerror={() => (failedKey = key)}
        />
      {/if}
    </div>
    <div class="ams-cap">
      <b>{np?.room}</b>
      <span class="ams-title">{np?.title}</span>
      {#if np?.artist}<span class="ams-artist">{np.artist}</span>{/if}
    </div>
  </div>
{/if}

<style>
  .ams {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: var(--photo-fill);
    color: var(--photo-on);
  }
  .ams-wash {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
  }
  .ams-wash :global(canvas) {
    display: block;
    width: 100%;
    height: 100%;
  }
  .ams-art {
    position: absolute;
    top: 48px;
    right: 60px;
    width: 440px;
    height: 440px;
    border-radius: var(--r);
    overflow: hidden;
    background: var(--photo-fill);
  }
  .ams-art img {
    position: absolute;
    top: 0;
    left: 0;
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
    opacity: 0;
    transition: opacity 0.3s var(--ease);
  }
  .ams-art img.loaded { opacity: 1; }
  .ams-ph {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    height: 100%;
    color: var(--photo-on-2);
  }
  .ams-cap {
    position: absolute;
    top: 60px;
    left: 60px;
    width: 660px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .ams-cap b {
    font-size: var(--fs-min);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  .ams-title, .ams-artist, .ams-cap b {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .ams-title { font-family: var(--serif); font-size: 44px; font-weight: 700; }
  .ams-artist { font-size: 28px; color: var(--photo-on-2); }
</style>

<script lang="ts">
  // The photo slideshow, shared by Photos, the Today tile and the ambient screen. At most two
  // slides are mounted (the outgoing one stays until the incoming fade ends), and the next
  // slide's first image is preloaded off-DOM. Timers and the Ken Burns drift stop when inactive.
  import { untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { photos, photoMeta, photoSrc, type PhotoItem } from '../../lib/state/photos.svelte';
  import { createDeck, type Layout, type Slide } from './deck';

  let {
    active,
    layout = 'auto',
    interval = 15000,
    captions = true,
    loud = false,
    size,
    onchange,
  }: {
    active: boolean;
    layout?: Layout;
    interval?: number;
    captions?: boolean;
    /** Captions at full strength instead of dimmed. */
    loud?: boolean;
    /** Overrides the image size of single-photo cover slides (the Today tile is small). */
    size?: 'full' | 'half';
    onchange?: (slide: Slide) => void;
  } = $props();

  const FADE_MS = 700;
  const deck = createDeck(() => photos.items);

  let slides = $state.raw<Slide[]>([]);
  let timer: ReturnType<typeof setInterval> | undefined;
  let fallback: ReturnType<typeof setTimeout> | undefined;
  let pruneTimer: ReturnType<typeof setTimeout> | undefined;
  let loading = false;
  let seq = 0;

  const imgSize = (s: Slide): 'full' | 'half' =>
    s.layout === 'polaroid' ? 'half' : s.layout === 'cover' && size ? size : 'full';

  // Shows a slide once its first image has loaded (or failed, or 2.5 s have passed).
  function show(s: Slide) {
    const mine = ++seq;
    loading = true;
    clearTimeout(fallback);
    const go = () => {
      if (mine !== seq) return;
      loading = false;
      clearTimeout(fallback);
      const kept = slides.filter((x) => x.key !== s.key).slice(-1);
      slides = [...kept, s];
      clearTimeout(pruneTimer);
      pruneTimer = setTimeout(prune, FADE_MS + 1800);
      onchange?.(s);
    };
    const im = new Image();
    im.onload = im.onerror = go;
    im.src = photoSrc(s.photos[0], imgSize(s));
    fallback = setTimeout(go, 2500);
  }

  function prune() {
    clearTimeout(pruneTimer);
    if (slides.length > 1) slides = slides.slice(-1);
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(next, interval);
  }

  export function next() {
    const s = deck.next(layout);
    if (!s) return;
    show(s);
    restart();
  }

  export function prev() {
    const s = deck.prev();
    if (!s) return;
    show(s);
    restart();
  }

  $effect(() => {
    if (!active) return;
    untrack(() => {
      if (!slides.length && !loading) next();
      else restart();
    });
    return () => {
      clearInterval(timer);
      timer = undefined;
    };
  });

  let lastLayout = untrack(() => layout);
  $effect(() => {
    const l = layout;
    untrack(() => {
      if (l === lastLayout) return;
      lastLayout = l;
      if (active) next();
    });
  });

  $effect(() => () => {
    clearInterval(timer);
    clearTimeout(fallback);
    clearTimeout(pruneTimer);
  });

  const src = (p: PhotoItem, s: Slide) => photoSrc(p, imgSize(s));
  const broken = (e: Event) => (e.currentTarget as HTMLElement).classList.add('is-broken');
</script>

{#snippet cap(s: Slide, m: boolean)}
  {@const meta = photoMeta(s.photos[0])}
  <div class="ss-cap">
    <div class="ss-cap-in" class:loud>
      <div class="ss-kicker">
        {#if meta.onThisDay}<b>On this day</b> · {/if}{meta.kicker}{meta.place ? ' · ' + meta.place : ''}
      </div>
      <div class="ss-date" class:ss-date--m={m}>{s.photos.length > 1 ? meta.monthYear : meta.date}</div>
    </div>
  </div>
{/snippet}

{#snippet pane(p: PhotoItem, s: Slide, cls: string)}
  <div class="ss-pane {cls}"><img class="ss-img" src={src(p, s)} alt="" onerror={broken} /></div>
{/snippet}

<div class="ss" class:paused={!active} style:--ss-dur="{interval + 2000}ms">
  {#each slides as s (s.key)}
    <div
      class="ss-slide ss-slide--{s.layout}"
      class:portrait={s.layout === 'cover' && s.photos[0].o === 'p'}
      in:fade={{ duration: FADE_MS }}
      onintroend={prune}>
      {#if s.layout === 'cover'}
        {#if s.photos[0].o === 'p'}
          <img class="ss-fit" src={src(s.photos[0], s)} alt="" onerror={broken} />
        {:else}
          <div class="ss-kb" style:--dx={s.dx} style:--dy={s.dy}>
            <img class="ss-img" src={src(s.photos[0], s)} alt="" onerror={broken} />
          </div>
        {/if}
        {#if captions}{@render cap(s, false)}{/if}
      {:else if s.layout === 'pair'}
        {@render pane(s.photos[0], s, '')}
        {@render pane(s.photos[1], s, '')}
        {#if captions}{@render cap(s, true)}{/if}
      {:else if s.layout === 'collage'}
        {@render pane(s.photos[0], s, 'ss-pane--a')}
        {@render pane(s.photos[1], s, 'ss-pane--b')}
        {@render pane(s.photos[2], s, 'ss-pane--c')}
        {#if captions}{@render cap(s, true)}{/if}
      {:else}
        {@const meta = photoMeta(s.photos[0])}
        <figure class="ss-polaroid" class:ss-polaroid--p={s.photos[0].o === 'p'} style:transform="rotate({s.rot}deg)">
          <div class="ss-polaroid-img"><img class="ss-img" src={src(s.photos[0], s)} alt="" onerror={broken} /></div>
          <figcaption><i>{meta.place ? meta.place + ', ' : ''}{meta.monthYear}</i></figcaption>
        </figure>
      {/if}
    </div>
  {/each}
</div>

<style>
  .ss { position: absolute; top: 0; right: 0; bottom: 0; left: 0; overflow: hidden; background: var(--photo-fill); }
  .ss-slide { position: absolute; top: 0; right: 0; bottom: 0; left: 0; overflow: hidden; background: var(--photo-fill); }
  .ss-img { display: block; width: 100%; height: 100%; object-fit: cover; object-position: 50% 30%; }
  .ss-img:global(.is-broken), .ss-fit:global(.is-broken) { visibility: hidden; }

  .ss-kb { position: absolute; top: 0; right: 0; bottom: 0; left: 0; overflow: hidden; background: var(--photo-fill); animation: ss-kb var(--ss-dur) linear both; }
  .paused .ss-kb { animation-play-state: paused; }
  @keyframes ss-kb {
    to { transform: scale(1.08) translate(var(--dx), var(--dy)); }
  }

  .ss-fit { position: absolute; top: 0; left: 50%; width: auto; height: 100%; transform: translateX(-50%); object-fit: contain; }

  .ss-slide--pair { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; background: var(--photo-gap); }
  .ss-slide--collage { display: grid; grid-template-columns: 3fr 2fr; grid-template-rows: 1fr 1fr; gap: 6px; background: var(--photo-gap); }
  .ss-pane { position: relative; overflow: hidden; background: var(--photo-fill); }
  .ss-pane--a { grid-row: 1 / 3; }

  .ss-polaroid {
    position: absolute; left: 50%; top: 50%; margin: 0;
    background: var(--photo-paper); padding: 18px 18px 0; border-radius: 4px;
    translate: -50% -52%;
  }
  .ss-polaroid-img { width: 660px; height: 470px; overflow: hidden; background: var(--photo-fill); }
  .ss-polaroid--p .ss-polaroid-img { width: 420px; height: 560px; }
  .ss-polaroid figcaption {
    padding: 16px 6px 20px; color: var(--photo-paper-ink); font-family: var(--serif); font-size: 30px;
  }

  /* Caption on a flat scrim band: no gradient. */
  .ss-cap { position: absolute; left: 0; right: 0; bottom: 0; z-index: 2; padding: 28px 44px 40px; background: var(--photo-scrim); pointer-events: none; }
  .ss-cap-in { color: var(--photo-on); max-width: 70%; opacity: 0.7; }
  .ss-cap-in.loud { opacity: 1; }
  .ss-kicker { font-size: var(--fs-label); font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; }
  .ss-kicker b { color: var(--warm); }
  .ss-date { font-family: var(--serif); font-size: 88px; line-height: 0.95; margin-top: 8px; }
  .ss-date--m { font-size: 60px; }

  /* Night dashboard: a static dim layer over the photos (no filter, no animation). */
  :global(.stage[data-mode="nightdash"]) .ss-slide::before {
    content: ''; position: absolute; top: 0; right: 0; bottom: 0; left: 0; z-index: 1;
    background: var(--photo-dim); pointer-events: none;
  }
</style>

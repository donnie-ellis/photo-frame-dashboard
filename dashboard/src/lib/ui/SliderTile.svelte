<script lang="ts">
  // Tap to toggle, drag sideways to dim. The level is committed on release only. The fill is scaled
  // with transform (not width) and drag updates are batched to one per animation frame.
  import Icon from './Icon.svelte';
  import { pressable } from './pressable';

  let {
    name,
    icon = 'bulb',
    on,
    level,
    pending = false,
    size = 'm',
    ontoggle,
    onlevel,
    color,
    onmore,
    moreLabel = 'More',
  }: {
    name: string;
    icon?: string;
    on: boolean;
    /** 1-100. Kept while off, so the tile shows 0 until it is switched on. */
    level: number;
    pending?: boolean;
    /** m = grid tile, l = the whole-room control. */
    size?: 'm' | 'l';
    ontoggle: () => void;
    /** Called once on release after a drag. 0 means off. */
    onlevel: (level: number) => void;
    /** A small dot showing the light's colour (a CSS colour). */
    color?: string;
    /** Adds a button, outside the slider, for a detail sheet. */
    onmore?: () => void;
    moreLabel?: string;
  } = $props();

  const SLOP = 10;

  let draft = $state<number | null>(null);
  let dragging = $state(false);

  let startX = 0;
  let startLevel = 0;
  let pxPerPercent = 1;
  let slopPx = SLOP;
  let active = false;
  let next = 0;
  let raf = 0;

  const shown = $derived(draft ?? (on ? level : 0));

  function down(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    // One layout read per touch. #stage is scaled to fit, so convert screen px back to layout px.
    const k = (document.getElementById('stage')?.getBoundingClientRect().width ?? 1280) / 1280;
    pxPerPercent = (el.offsetWidth * k) / 100;
    slopPx = SLOP * k;
    startX = e.clientX;
    startLevel = on ? level : 0;
    active = true;
    dragging = false;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone.
    }
  }

  function move(e: PointerEvent) {
    if (!active) return;
    const dx = e.clientX - startX;
    if (!dragging && Math.abs(dx) > slopPx) dragging = true;
    if (!dragging) return;
    next = Math.max(0, Math.min(100, Math.round(startLevel + dx / pxPerPercent)));
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        draft = next;
      });
    }
  }

  function finish() {
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  function up() {
    if (!active) return;
    const wasDrag = dragging;
    const lvl = next;
    finish();
    dragging = false;
    if (wasDrag) onlevel(lvl);
    else ontoggle();
    draft = null;
  }

  function cancel() {
    finish();
    dragging = false;
    draft = null;
  }
</script>

<div class="slider-wrap">
<button
  class="slider slider--{size}"
  class:lit={shown > 0}
  class:pending
  class:drag={dragging}
  aria-label="{name}, {shown > 0 ? shown + '%' : 'off'}"
  onpointerdown={down}
  onpointermove={move}
  onpointerup={up}
  onpointercancel={cancel}
  {@attach pressable}>
  <span class="slider-fill" style:transform="scaleX({shown / 100})"></span>
  <span class="slider-icon"><Icon name={icon} size={size === 'l' ? 40 : 30} /></span>
  <span class="slider-text">
    <span class="slider-name">{name}</span>
    <span class="slider-level">
      {#if color}<span class="slider-dot" style:background={color}></span>{/if}{shown > 0 ? shown + '%' : 'Off'}
    </span>
  </span>
</button>
{#if onmore}
  <button class="slider-more" aria-label={moreLabel} onclick={onmore} {@attach pressable}>
    <Icon name="sliders" size={26} />
  </button>
{/if}
</div>

<style>
  .slider-wrap { position: relative; }
  .slider {
    position: relative;
    overflow: hidden;
    width: 100%;
    min-height: 112px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: flex-start;
    text-align: left;
    background: var(--card);
    color: var(--mute);
    border: 2px solid var(--line);
    border-radius: var(--r);
    touch-action: pan-y;
    transition: transform 0.15s var(--ease);
  }
  .slider--l { min-height: 140px; padding: 18px 24px; }
  .lit { color: var(--ink); border-color: var(--ink); }
  .pending { opacity: 0.6; }
  .drag { border-style: dashed; }
  .slider:global(.is-pressed):not(.drag) { transform: scale(0.97); transition-duration: 0s; }

  .slider-fill {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: var(--warm);
    transform: scaleX(0);
    transform-origin: left center;
    transition: transform 0.15s var(--ease);
  }
  .drag .slider-fill { transition: none; }
  .slider-more {
    position: absolute;
    top: 0;
    right: 0;
    width: var(--tap);
    height: var(--tap);
    display: grid;
    place-items: center;
    color: var(--ink);
    transition: transform 0.15s var(--ease);
  }
  .slider-more:global(.is-pressed) { transform: scale(0.9); transition-duration: 0s; }
  .slider-dot {
    display: inline-block;
    width: 14px;
    height: 14px;
    margin-right: 6px;
    border-radius: 50%;
    border: 2px solid var(--ink);
    vertical-align: -2px;
  }
  .slider-icon, .slider-text { position: relative; }
  .slider-text { display: flex; flex-direction: column; gap: 2px; max-width: 100%; }
  .slider-name {
    font-size: var(--fs-body);
    font-weight: 800;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .slider--l .slider-name { font-size: var(--fs-m); }
  .slider-level { font-size: var(--fs-min); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
  .slider--l .slider-level { font-size: var(--fs-body); }
</style>

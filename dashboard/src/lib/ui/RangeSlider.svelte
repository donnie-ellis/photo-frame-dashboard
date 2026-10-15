<script lang="ts">
  // A horizontal value slider (e.g. warm to cool). Drag or tap the track. The thumb moves with
  // transform only, drag updates are batched to one per animation frame, and the value is
  // committed on release.
  import { pressable } from './pressable';

  let {
    value,
    min,
    max,
    step = 1,
    label,
    startLabel,
    endLabel,
    pending = false,
    onchange,
  }: {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    startLabel?: string;
    endLabel?: string;
    pending?: boolean;
    /** Called once on release. */
    onchange: (value: number) => void;
  } = $props();

  const THUMB = 40;

  let draft = $state<number | null>(null);
  let width = $state(0);
  let trackLeft = 0;
  let trackPx = 1;
  let k = 1;
  let next = 0;
  let raf = 0;
  let active = false;

  const shown = $derived(draft ?? value);
  const frac = $derived(max > min ? (Math.max(min, Math.min(max, shown)) - min) / (max - min) : 0);

  function valueAt(clientX: number): number {
    const f = Math.max(0, Math.min(1, (clientX - trackLeft) / trackPx));
    const v = min + Math.round((f * (max - min)) / step) * step;
    return Math.max(min, Math.min(max, v));
  }

  function down(e: PointerEvent) {
    const el = e.currentTarget as HTMLElement;
    // One layout read per touch. #stage is scaled to fit, so work in screen px and convert back.
    k = (document.getElementById('stage')?.getBoundingClientRect().width ?? 1280) / 1280;
    const r = el.getBoundingClientRect();
    trackLeft = r.left + (THUMB / 2) * k;
    trackPx = Math.max(1, r.width - THUMB * k);
    active = true;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      // Pointer already gone.
    }
    next = valueAt(e.clientX);
    draft = next;
  }

  function move(e: PointerEvent) {
    if (!active) return;
    next = valueAt(e.clientX);
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0;
        draft = next;
      });
    }
  }

  function up() {
    if (!active) return;
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    const v = next;
    draft = null;
    if (v !== value) onchange(v);
  }

  function cancel() {
    active = false;
    cancelAnimationFrame(raf);
    raf = 0;
    draft = null;
  }
</script>

<div class="rng" class:rng--pending={pending}>
  <div
    class="rng-track"
    role="slider"
    tabindex="-1"
    aria-label={label}
    aria-valuemin={min}
    aria-valuemax={max}
    aria-valuenow={shown}
    bind:clientWidth={width}
    onpointerdown={down}
    onpointermove={move}
    onpointerup={up}
    onpointercancel={cancel}
    {@attach pressable}>
    <span class="rng-rail"></span>
    <span class="rng-thumb" style:transform="translateX({frac * Math.max(0, width - THUMB)}px)"><span class="rng-knob"></span></span>
  </div>
  {#if startLabel || endLabel}
    <div class="rng-ends"><span>{startLabel}</span><span>{endLabel}</span></div>
  {/if}
</div>

<style>
  .rng { display: flex; flex-direction: column; gap: 6px; }
  .rng--pending { opacity: 0.6; }
  .rng-track {
    position: relative;
    height: var(--tap);
    touch-action: none;
  }
  .rng-rail {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 16px;
    margin-top: -8px;
    border-radius: 8px;
    background: var(--paper-2);
    border: 2px solid var(--line);
  }
  .rng-thumb {
    position: absolute;
    left: 0;
    top: 50%;
    width: 40px;
    height: 40px;
    margin-top: -20px;
  }
  .rng-knob {
    display: block;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: var(--ink);
    transition: transform 0.15s var(--ease);
  }
  .rng-track:global(.is-pressed) .rng-knob { transform: scale(1.15); transition-duration: 0s; }
  .rng-ends {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-min);
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--mute);
  }
</style>

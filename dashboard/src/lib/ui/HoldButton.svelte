<script lang="ts">
  // Press and hold to confirm a consequential action (unlock, shut off water). Releasing early
  // calls oncancel, so the caller can say "keep holding". Replaces App.hold in js/app.js.
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';

  let {
    ms = 1000,
    icon,
    variant = 'solid',
    onhold,
    oncancel,
    children,
  }: {
    ms?: number;
    icon?: string;
    variant?: 'solid' | 'light';
    onhold: () => void;
    oncancel?: () => void;
    children: Snippet;
  } = $props();

  let holding = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function down() {
    holding = true;
    timer = setTimeout(() => {
      timer = undefined;
      holding = false;
      onhold();
    }, ms);
  }

  function up(e: PointerEvent) {
    if (!timer) return;
    clearTimeout(timer);
    timer = undefined;
    holding = false;
    if (e.type === 'pointerup') oncancel?.();
  }
</script>

<button
  class="hold hold--{variant}"
  class:holding
  style:--hold="{ms}ms"
  onpointerdown={down}
  onpointerup={up}
  onpointercancel={up}
  onpointerleave={up}>
  <span class="fill" aria-hidden="true"></span>
  {#if icon}<Icon name={icon} size={30} />{/if}
  <span class="text">{@render children()}</span>
</button>

<style>
  .hold {
    position: relative;
    overflow: hidden;
    min-height: 80px;
    padding: 0 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 999px;
    font-size: 20px;
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    touch-action: none;
  }
  .hold--solid { background: var(--ink); color: var(--paper); }
  .hold--light { background: var(--paper); color: var(--ink); }
  .hold :global(svg), .text { position: relative; }

  /* Progress grows with transform (compositor only), never width. Snaps back on release. */
  .fill {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    transform: scaleX(0);
    transform-origin: left center;
  }
  .hold--solid .fill { background: rgb(var(--on-ink-rgb) / 0.22); }
  .hold--light .fill { background: rgb(var(--tint-rgb) / 0.12); }
  .holding .fill { transform: scaleX(1); transition: transform var(--hold) linear; }
</style>

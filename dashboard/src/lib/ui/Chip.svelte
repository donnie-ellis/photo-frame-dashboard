<script lang="ts">
  import type { Snippet } from 'svelte';
  import { pressable } from './pressable';

  let {
    selected = false,
    ghost = false,
    tint,
    tall = false,
    onclick,
    children,
  }: {
    selected?: boolean;
    /** Outlined instead of filled, for secondary choices. */
    ghost?: boolean;
    /** A person's App.pstyle() string: tints the chip in their colour, filled when selected. */
    tint?: string;
    /** Same height as a tinted chip, for a plain chip beside them. */
    tall?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

<button
  class="choice"
  class:ghost
  class:tinted={!!tint}
  class:tall
  class:on={selected}
  style={tint}
  aria-pressed={selected}
  {onclick}
  {@attach pressable}
>
  {@render children()}
</button>

<style>
  .choice {
    min-height: 56px;
    padding: 0 20px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    border-radius: 999px;
    background: var(--paper-2);
    font-size: 18px;
    font-weight: 700;
    transition: transform 0.15s var(--ease);
  }
  .ghost { background: transparent; border: 2px solid var(--line); }
  .on { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .tall, .tinted { min-height: var(--tap); }
  .tinted { background: rgb(var(--c-rgb) / 0.14); }
  .tinted.on { background: var(--c); border-color: var(--c); color: var(--c-ink); }
  .choice:global(.is-pressed) { transform: scale(0.95); transition-duration: 0s; }
</style>

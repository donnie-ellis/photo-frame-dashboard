<script lang="ts">
  import type { Snippet } from 'svelte';
  import { pressable } from './pressable';

  let {
    selected = false,
    ghost = false,
    onclick,
    children,
  }: {
    selected?: boolean;
    /** Outlined instead of filled, for secondary choices. */
    ghost?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();
</script>

<button class="choice" class:ghost class:on={selected} aria-pressed={selected} {onclick} {@attach pressable}>
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
  .on { background: var(--ink); border-color: var(--ink); color: var(--paper); }
  .choice:global(.is-pressed) { transform: scale(0.95); transition-duration: 0s; }
</style>

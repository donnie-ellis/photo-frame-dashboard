<script lang="ts">
  import type { Snippet } from 'svelte';
  import Icon from './Icon.svelte';
  import { pressable } from './pressable';

  let {
    variant = 'ghost',
    icon,
    disabled = false,
    onclick,
    children,
  }: {
    variant?: 'solid' | 'ghost';
    icon?: string;
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
    children?: Snippet;
  } = $props();
</script>

<button class="button button--{variant}" {disabled} {onclick} {@attach pressable}>
  {#if icon}<Icon name={icon} />{/if}
  {@render children?.()}
</button>

<style>
  .button {
    min-height: var(--tap);
    padding: 0 28px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 999px;
    border: 2px solid var(--ink);
    font-size: 18px;
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    transition: transform 0.15s var(--ease);
  }
  .button--solid { background: var(--accent); border-color: var(--accent); color: var(--accent-ink); }
  .button--ghost { background: transparent; }
  .button:global(.is-pressed) { transform: scale(0.96); transition-duration: 0s; }
  .button:disabled { opacity: 0.4; }
</style>

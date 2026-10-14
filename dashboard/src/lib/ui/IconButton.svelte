<script lang="ts">
  import Icon from './Icon.svelte';
  import { pressable } from './pressable';

  let {
    icon,
    label,
    variant = 'outline',
    size = 'm',
    disabled = false,
    onclick,
  }: {
    icon: string;
    /** Spoken label: the button has no visible text. */
    label: string;
    variant?: 'outline' | 'solid' | 'soft';
    /** m = 64px (var(--tap)), l = 72px floating action button. */
    size?: 'm' | 'l';
    disabled?: boolean;
    onclick?: (e: MouseEvent) => void;
  } = $props();
</script>

<button
  class="ib ib--{variant} ib--{size}"
  aria-label={label}
  {disabled}
  {onclick}
  {@attach pressable}>
  <Icon name={icon} size={size === 'l' ? 30 : 28} />
</button>

<style>
  .ib {
    flex: none;
    display: grid;
    place-items: center;
    border-radius: 50%;
    transition: transform 0.15s var(--ease);
  }
  .ib--m { width: var(--tap); height: var(--tap); }
  .ib--l { width: 72px; height: 72px; }
  .ib--outline { border: 2px solid var(--line); }
  .ib--solid { background: var(--accent); color: var(--accent-ink); }
  .ib--soft { background: rgb(var(--tint-rgb) / 0.08); }
  .ib:global(.is-pressed) { transform: scale(0.92); transition-duration: 0s; }
  .ib--outline:global(.is-pressed) { background: var(--paper-2); }
  .ib:disabled { opacity: 0.4; }
</style>

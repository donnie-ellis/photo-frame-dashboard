<script lang="ts" generics="T extends string">
  import { pressable } from './pressable';

  let {
    options,
    value = $bindable(),
    tone = 'light',
    onchange,
  }: {
    options: { value: T; label: string; count?: number }[];
    value: T;
    /** light: on paper. dark: on ink. glass: over photos. */
    tone?: 'light' | 'dark' | 'glass';
    onchange?: (value: T) => void;
  } = $props();

  function pick(v: T) {
    if (v === value) return;
    value = v;
    onchange?.(v);
  }
</script>

<div class="segmented segmented--{tone}" role="radiogroup">
  {#each options as o (o.value)}
    <button
      role="radio"
      aria-checked={o.value === value}
      class:on={o.value === value}
      onclick={() => pick(o.value)}
      {@attach pressable}>
      {o.label}{#if o.count != null}<span class="num">{o.count}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .segmented { display: inline-flex; border-radius: 999px; padding: 4px; gap: 2px; }
  button {
    min-height: 56px;
    padding: 0 22px;
    border-radius: 999px;
    font-size: 17px;
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    white-space: nowrap;
    text-align: center;
  }
  button:global(.is-pressed) { opacity: 0.7; }
  .num { font-size: 19px; opacity: 0.6; margin-left: 4px; }

  .segmented--light { background: var(--paper-2); }
  .segmented--light button { color: var(--ink-2); }
  .segmented--light button.on { background: var(--accent); color: var(--accent-ink); }

  .segmented--dark { background: rgba(255, 255, 255, 0.1); }
  .segmented--dark button { color: rgba(255, 255, 255, 0.75); }
  .segmented--dark button.on { background: var(--paper); color: var(--ink); }

  .segmented--glass { background: rgba(0, 0, 0, 0.35); }
  .segmented--glass button { color: rgba(255, 255, 255, 0.85); }
  .segmented--glass button.on { background: #fff; color: var(--ink); }
</style>

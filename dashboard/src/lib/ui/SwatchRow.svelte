<script lang="ts">
  // A grid of big pick targets, each with a colour chip: colour swatches (chip only) or labelled
  // presets such as white temperatures. The selected one has a static ring.
  import { pressable } from './pressable';

  type Swatch = {
    id: string;
    /** Also the accessible name. Shown when `sub` or `labels` is set. */
    label: string;
    /** Any CSS colour, normally a token (`var(--swatch-red)`). */
    color: string;
    /** Second line, such as "2700K". */
    sub?: string;
  };

  let {
    swatches,
    selected,
    pending = false,
    labels = false,
    columns = 4,
    onpick,
  }: {
    swatches: Swatch[];
    selected?: string | null;
    pending?: boolean;
    /** Show the label (and `sub`) next to the chip instead of colour only. */
    labels?: boolean;
    columns?: number;
    onpick: (id: string) => void;
  } = $props();
</script>

<div class="swr" class:swr--pending={pending} style:grid-template-columns="repeat({columns}, 1fr)">
  {#each swatches as s (s.id)}
    <button
      class="swr-b"
      class:swr-b--on={s.id === selected}
      class:swr-b--lbl={labels}
      style:background={labels ? undefined : s.color}
      aria-label={s.sub ? s.label + ', ' + s.sub : s.label}
      aria-pressed={s.id === selected}
      onclick={() => onpick(s.id)}
      {@attach pressable}>
      {#if labels}
        <span class="swr-chip" style:background={s.color}></span>
        <span class="swr-text">
          <span class="swr-label">{s.label}</span>
          {#if s.sub}<span class="swr-sub">{s.sub}</span>{/if}
        </span>
      {/if}
    </button>
  {/each}
</div>

<style>
  .swr { display: grid; gap: 8px; }
  .swr--pending { opacity: 0.6; }
  .swr-b {
    min-height: var(--tap);
    min-width: var(--tap);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border: 3px solid var(--line);
    border-radius: var(--r);
    transition: transform 0.15s var(--ease);
  }
  .swr-b--lbl { background: var(--card); text-align: left; }
  .swr-b--on { border-color: var(--ink); }
  .swr-b:global(.is-pressed) { transform: scale(0.95); transition-duration: 0s; }
  .swr-chip {
    flex: none;
    width: 28px;
    height: 28px;
    border-radius: 50%;
    border: 2px solid var(--line);
  }
  .swr-text { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .swr-label { font-size: var(--fs-body); font-weight: 800; line-height: 1.1; }
  .swr-sub { font-size: var(--fs-min); font-weight: 700; color: var(--mute); }
</style>

<script lang="ts">
  // The events of one lane: overlap layout, then event blocks and "+N more" blocks.
  import { pressable } from '../../lib/ui';
  import type { CalEvent } from '../../lib/state/calendar.svelte';
  import EvBlock from './EvBlock.svelte';
  import { clampTop, layout, y } from './layout';

  let {
    list,
    day,
    lane,
    now,
    onopen,
    onmore,
  }: {
    list: CalEvent[];
    day: Date;
    lane?: string;
    now: Date;
    onopen: (e: CalEvent) => void;
    onmore: (list: CalEvent[]) => void;
  } = $props();

  const placed = $derived(layout(list));
</script>

{#each placed as it (it.kind === 'ev' ? it.e.id : 'more-' + it.more.map((e) => e.id).join())}
  {@const w = 100 / it.cols}
  {@const left = `calc(${it.col * w}% + 2px)`}
  {@const width = `calc(${w}% - 4px)`}
  {#if it.kind === 'more'}
    {@const t = y(it.start)}
    <button
      class="cal-more"
      style="top:{t}px;height:{Math.max(30, y(it.end) - t - 3)}px;left:{left};width:{width}"
      onclick={() => onmore(it.more)}
      {@attach pressable}>
      +{it.more.length}<small>more</small>
    </button>
  {:else}
    {@const b = clampTop(it.e, day)}
    <EvBlock e={it.e} top={b.top} height={b.h} {left} {width} {lane} half={it.cols > 1} {now} {onopen} />
  {/if}
{/each}

<style>
  .cal-more {
    position: absolute;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: var(--r-s);
    background: var(--paper);
    color: var(--ink);
    border: 2px dashed var(--ink-2);
    font-size: 24px;
    font-weight: 900;
    font-stretch: 70%;
    transition: transform 0.15s var(--ease);
  }
  .cal-more:global(.is-pressed) { transform: scale(0.98); transition-duration: 0s; }
  small { font-size: var(--fs-min); text-transform: uppercase; letter-spacing: 0.08em; }
</style>

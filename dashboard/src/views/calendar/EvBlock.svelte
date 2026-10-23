<script lang="ts">
  // One event on the time grid, positioned absolutely inside a lane.
  import { Icon, pressable } from '../../lib/ui';
  import type { CalEvent } from '../../lib/state/calendar.svelte';
  import { PX } from './layout';

  let {
    e,
    top,
    height,
    left,
    width,
    lane,
    half = false,
    now,
    onopen,
  }: {
    e: CalEvent;
    top: number;
    height: number;
    /** CSS lengths. */
    left: string;
    width: string;
    /** Person id of the lane: that person is left out of the "with" dots. */
    lane?: string;
    half?: boolean;
    now: Date;
    onopen: (e: CalEvent) => void;
  } = $props();
  const App = window.App;

  const family = $derived(App.isFamily(e));
  const short = $derived((+e.end - +e.start) / 60000 < 45);
  const others = $derived(
    family ? window.DATA.people.map((p) => p.id) : lane ? e.people.filter((id) => id !== lane) : e.people.length > 1 ? e.people : [],
  );
</script>

<button
  class="cal-ev"
  class:is-past={+e.end <= +now}
  class:is-now={+e.start <= +now && +e.end > +now}
  class:is-short={short}
  class:is-family={family}
  class:is-half={half}
  class:has-with={others.length > 0}
  style="{App.pstyle(App.evColor(e))};top:{top}px;height:{height}px;left:{left};width:{width}"
  onclick={() => onopen(e)}
  {@attach pressable}>
  {#if e.travel}<span class="cal-ev-travel" style:height="{(e.travel * PX) / 60}px"></span>{/if}
  <span class="cal-ev-title">{e.title}</span>
  <span class="cal-ev-meta">
    {App.fmt.range(e.start, e.end)}
    {#if e.travel}
      · <b><Icon name="car" size={16} />Leave {App.fmt.time(App.leaveBy(e), false)}</b>
    {/if}
  </span>
  {#if others.length}
    <span class="cal-ev-with dots">
      {#each others as id (id)}<i style="{App.pstyle(id)};width:14px;height:14px"></i>{/each}
    </span>
  {/if}
</button>

<style>
  .cal-ev {
    position: absolute;
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
    gap: 2px;
    padding: 7px 12px;
    border-radius: var(--r-s);
    background: var(--c);
    color: var(--c-ink);
    text-align: left;
    z-index: 1;
    transition: transform 0.15s var(--ease);
  }
  .cal-ev:global(.is-pressed) { transform: scale(0.98); transition-duration: 0s; }
  .cal-ev-title {
    font-size: 18px;
    font-weight: 800;
    line-height: 1.1;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding-right: 30px;
  }
  .cal-ev-meta {
    font-size: var(--fs-min);
    font-weight: 600;
    opacity: 0.9;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cal-ev-meta b {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 800;
    vertical-align: bottom;
  }
  .is-short { flex-direction: row; align-items: center; gap: 8px; padding-top: 0; padding-bottom: 0; }
  .is-short .cal-ev-title { font-size: 16px; padding-right: 0; flex: none; max-width: 60%; }
  .is-short .cal-ev-with { position: static; margin-left: auto; flex: none; }
  .is-half.is-short .cal-ev-meta { display: none; }
  .is-half.is-short .cal-ev-title { max-width: 100%; flex: 1; min-width: 0; }
  .is-half.is-short .cal-ev-with { margin-left: 0; }
  .is-half .cal-ev-title { padding-right: 0; }
  .is-half.has-with:not(.is-short) .cal-ev-title { padding-right: 30px; }
  .is-past { opacity: 0.38; }
  .is-now { box-shadow: 0 0 0 3px var(--paper), 0 0 0 6px var(--c); z-index: 2; }
  .is-family { background: var(--ink); color: var(--on-ink); }
  .cal-ev-with { position: absolute; right: 8px; top: 9px; }
  .cal-ev-with i { box-shadow: 0 0 0 2px var(--c-ink); }
  .cal-ev-travel {
    position: absolute;
    left: 8px;
    right: 8px;
    bottom: 100%;
    border-radius: 8px 8px 0 0;
    background: repeating-linear-gradient(-45deg, rgb(var(--c-rgb) / 0.45) 0 5px, rgb(var(--c-rgb) / 0.08) 5px 10px);
  }
</style>

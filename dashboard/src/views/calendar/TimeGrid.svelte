<script lang="ts">
  // Scrolling hour grid shared by the day and 3-day views: hour labels, the lanes (children) and
  // the now-line. Scrolls to the current time when the shown days change, not on data updates.
  import { untrack, type Snippet } from 'svelte';
  import { END, GRID_H, PX, START, y } from './layout';

  let {
    days,
    now,
    cols,
    children,
  }: {
    days: Date[];
    now: Date;
    /** Number of lane columns. */
    cols: number;
    children: Snippet;
  } = $props();
  const App = window.App;

  const hours = Array.from({ length: END - START + 1 }, (_, i) => {
    const h = START + i;
    return { h, top: i * PX, label: h === 12 ? 'Noon' : `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}` };
  });

  const todayIdx = $derived(days.findIndex((d) => App.sameDay(d, now)));
  const showLine = $derived(todayIdx >= 0 && now.getHours() >= START && now.getHours() < END);

  let scroller: HTMLDivElement;
  const key = $derived(days.map((d) => +d).join());
  $effect(() => {
    key;
    untrack(() => {
      scroller.scrollTop = Math.max(0, y(window.App.now()) - 170);
    });
  });
</script>

<div class="cal-scroll" bind:this={scroller}>
  <div class="cal-grid" style:height="{GRID_H}px">
    {#each hours as hr (hr.h)}
      <div class="cal-hr" style:top="{hr.top}px"><span>{hr.label}</span></div>
    {/each}
    <div class="cal-lanes" style:--cols={cols}>{@render children()}</div>
    {#if showLine}
      <div
        class="cal-now"
        style:top="{y(now)}px"
        style:left="calc(64px + (100% - 64px) * {todayIdx} / {days.length})"
        style:right="calc((100% - 64px) * {days.length - todayIdx - 1} / {days.length})">
        {#if todayIdx === 0}<span class="num">{App.fmt.time(now, false)}</span>{/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .cal-scroll { flex: 1; min-height: 0; overflow-y: auto; overscroll-behavior: contain; position: relative; }
  .cal-grid { position: relative; margin: 14px 0; }
  .cal-hr { position: absolute; left: 64px; right: 0; border-top: 1px solid var(--line); }
  .cal-hr span {
    position: absolute;
    left: -64px;
    width: 56px;
    top: -9px;
    text-align: right;
    font-size: var(--fs-min);
    font-weight: 700;
    font-stretch: 80%;
    color: var(--mute);
    white-space: nowrap;
  }
  .cal-lanes {
    position: absolute;
    left: 64px;
    right: 0;
    top: 0;
    bottom: 0;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
  }
  .cal-now {
    position: absolute;
    height: 0;
    border-top: 3px solid var(--alert);
    z-index: 4;
    pointer-events: none;
  }
  .cal-now::before {
    content: '';
    position: absolute;
    left: -7px;
    top: -8px;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: var(--alert);
  }
  .cal-now span {
    position: absolute;
    right: calc(100% + 10px);
    top: -15px;
    background: var(--alert);
    color: var(--on-ink);
    border-radius: 8px;
    padding: 3px 7px;
    font-size: 17px;
    line-height: 1.2;
  }
</style>

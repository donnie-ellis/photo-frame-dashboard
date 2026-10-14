<script lang="ts">
  // One lane per person: what is left today. Recomputed each minute and when the events change.
  import { pressable } from '../../lib/ui';
  import { calendar } from '../../lib/state/calendar.svelte';

  let { now }: { now: Date } = $props();
  const App = window.App;
  const SHOWN = 3;

  const lanes = $derived.by(() => {
    // Read only for the dependency: timedOn() reads window.DATA.events.
    calendar.events;
    return window.DATA.people.map((p) => {
      const list = App.timedOn(now, p.id).filter((e) => +e.end > +now);
      // A "+N more" row takes the last slot, so it keeps a full-size tap target.
      const shown = list.length > SHOWN ? list.slice(0, SHOWN - 1) : list;
      return { p, shown, more: list.length - shown.length };
    });
  });
</script>

<div class="td-lanes" style:--cols={lanes.length}>
  {#each lanes as lane (lane.p.id)}
    <div class="td-lane" style={App.pstyle(lane.p)}>
      <div class="td-lane-head">
        <span class="avatar td-av">{lane.p.name[0]}</span>
        <b>{lane.p.name}</b>
      </div>
      {#each lane.shown as e (e.id)}
        {@const cur = +e.start <= +now}
        <button class="td-ev" class:is-now={cur} onclick={() => App.eventSheet(App.findEvent(e.id))} {@attach pressable}>
          <span class="td-ev-t">{cur ? 'Now' : App.fmt.time(e.start, false)}</span>
          <span class="td-ev-n">{e.title}</span>
        </button>
      {:else}
        <div class="td-free serif"><i>Free</i> the rest of the day</div>
      {/each}
      {#if lane.more > 0}
        <button class="td-more" onclick={() => App.go('calendar')} {@attach pressable}>+{lane.more} more</button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .td-lanes { display: grid; grid-template-columns: repeat(var(--cols), 1fr); gap: 12px; min-height: 0; }
  .td-lane { display: flex; flex-direction: column; gap: 6px; min-width: 0; border-top: 6px solid var(--c); padding-top: 10px; }
  .td-lane-head { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
  .td-av { width: 30px; height: 30px; font-size: 14px; }
  .td-lane-head b {
    font-size: 18px;
    font-weight: 800;
    font-stretch: 80%;
    text-transform: uppercase;
    letter-spacing: 0.06em;
  }
  .td-ev {
    width: 100%;
    min-width: 0;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    text-align: left;
    min-height: var(--tap);
    padding: 7px 12px;
    border-radius: var(--r-s);
    background: rgb(var(--c-rgb) / 0.12);
    transition: transform 0.15s var(--ease);
  }
  .td-ev:global(.is-pressed), .td-more:global(.is-pressed) { transform: scale(0.97); transition-duration: 0s; }
  .td-ev-t { font-size: 16px; font-weight: 800; font-stretch: 70%; font-variant-numeric: tabular-nums; color: var(--ink-2); }
  .td-ev-n {
    display: block;
    width: 100%;
    font-size: 18px;
    font-weight: 600;
    line-height: 1.2;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .td-ev.is-now { background: var(--c); color: var(--c-ink); }
  .td-ev.is-now .td-ev-t { color: inherit; text-transform: uppercase; letter-spacing: 0.08em; }
  .td-free { font-size: 21px; color: var(--mute); padding: 6px 2px; line-height: 1.1; }
  .td-more {
    min-height: var(--tap);
    padding: 0 12px;
    border-radius: var(--r-s);
    text-align: left;
    font-size: 16px;
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--ink-2);
    border: 2px solid var(--line);
    transition: transform 0.15s var(--ease);
  }
</style>

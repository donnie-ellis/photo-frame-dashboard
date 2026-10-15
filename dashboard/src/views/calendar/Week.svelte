<script lang="ts">
  // Rolling seven days from the shown date. Tapping a column opens that day.
  import { pressable } from '../../lib/ui';
  import { calendar, type CalEvent } from '../../lib/state/calendar.svelte';

  let {
    date,
    now,
    onopen,
    onday,
  }: {
    date: Date;
    now: Date;
    onopen: (e: CalEvent) => void;
    onday: (d: Date) => void;
  } = $props();
  const App = window.App;

  const cols = $derived.by(() => {
    // Read only for the dependency: the helpers read window.DATA.events.
    calendar.events;
    return [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const d = App.addDays(date, i);
      const allDay = App.allDayOn(d);
      const list = App.timedOn(d);
      const max = 7 - allDay.length;
      return { d, allDay, shown: list.slice(0, max), more: list.length - max, free: !list.length && !allDay.length };
    });
  });
</script>

<div class="cal-week">
  {#each cols as c (+c.d)}
    <div class="cal-col" class:is-today={App.sameDay(c.d, now)}>
      <button class="cal-wh" onclick={() => onday(c.d)} {@attach pressable}>
        <b>{App.fmt.dayShort(c.d)}</b><span class="num">{c.d.getDate()}</span>
      </button>
      {#each c.allDay as e (e.id)}
        <button class="cal-wad" style={App.pstyle(App.evColor(e))} onclick={() => onopen(e)} {@attach pressable}>{e.title}</button>
      {/each}
      {#each c.shown as e (e.id)}
        <button
          class="cal-wev"
          class:is-past={+e.end <= +now}
          style={App.pstyle(App.evColor(e))}
          onclick={() => onopen(e)}
          {@attach pressable}>
          <span class="cal-wt">{App.fmt.time(e.start, false)}</span>
          <span class="cal-wn">{e.title}</span>
        </button>
      {/each}
      {#if c.more > 0}
        <button class="cal-wmore" onclick={() => onday(c.d)} {@attach pressable}>+{c.more} more</button>
      {/if}
      {#if c.free}
        <button class="cal-wfree serif" onclick={() => onday(c.d)} {@attach pressable}><i>Free</i></button>
      {/if}
    </div>
  {/each}
</div>

<style>
  .cal-week { height: 100%; display: grid; grid-template-columns: repeat(7, 1fr); gap: 10px; }
  .cal-col { display: flex; flex-direction: column; gap: 6px; min-width: 0; min-height: 0; }
  .cal-wh {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    padding: 6px 10px 8px;
    border-bottom: 5px solid var(--ink);
    margin-bottom: 4px;
    min-height: var(--tap);
    text-align: left;
  }
  .cal-wh b { font-size: 18px; font-weight: 800; font-stretch: 80%; text-transform: uppercase; letter-spacing: 0.06em; }
  .cal-wh .num { font-size: 32px; line-height: 0.9; }
  .cal-wh:global(.is-pressed) { opacity: 0.7; }
  .is-today .cal-wh { background: var(--ink); color: var(--paper); border-radius: var(--r-s) var(--r-s) 0 0; }
  .cal-wad {
    flex: none;
    min-height: 40px;
    padding: 0 10px;
    border-radius: 8px;
    background: var(--c);
    color: var(--c-ink);
    font-size: var(--fs-min);
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
  }
  .cal-wev {
    flex: none;
    min-height: 60px;
    padding: 6px 10px;
    border-radius: 10px;
    display: flex;
    flex-direction: column;
    gap: 1px;
    background: rgb(var(--c-rgb) / 0.14);
    text-align: left;
  }
  .cal-wad:global(.is-pressed), .cal-wev:global(.is-pressed), .cal-wmore:global(.is-pressed), .cal-wfree:global(.is-pressed) { opacity: 0.7; }
  .cal-wev.is-past { opacity: 0.45; }
  .cal-wt::before {
    content: '';
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: var(--c);
    margin-right: 6px;
    vertical-align: 1px;
  }
  .cal-wt {
    font-size: var(--fs-min);
    font-weight: 800;
    font-stretch: 70%;
    font-variant-numeric: tabular-nums;
    color: var(--ink-2);
  }
  .cal-wn {
    font-size: 16px;
    font-weight: 600;
    line-height: 1.15;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
  }
  .cal-wmore {
    flex: none;
    min-height: 48px;
    font-size: 15px;
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    text-align: left;
    padding: 0 10px;
    color: var(--ink-2);
  }
  .cal-wfree { flex: 1; font-size: 22px; color: var(--mute); padding: 8px 10px; text-align: left; align-self: stretch; }
</style>

<script lang="ts">
  // Three days side by side, all events in one column per day.
  import { Icon, pressable } from '../../lib/ui';
  import { calendar, type CalEvent } from '../../lib/state/calendar.svelte';
  import TimeGrid from './TimeGrid.svelte';
  import Blocks from './Blocks.svelte';

  let {
    date,
    now,
    onopen,
    onmore,
  }: {
    date: Date;
    now: Date;
    onopen: (e: CalEvent) => void;
    onmore: (list: CalEvent[]) => void;
  } = $props();
  const App = window.App;

  const days = $derived([0, 1, 2].map((i) => App.addDays(date, i)));

  const data = $derived.by(() => {
    // Read only for the dependency: the helpers read window.DATA.events.
    calendar.events;
    const s0 = App.dayStart(days[0]);
    const s3 = App.addDays(s0, 3);
    const allDay = days.some((d) => App.allDayOn(d).length)
      ? App.events()
          .filter((e) => e.allDay && e.start < s3 && e.end > s0)
          .map((e) => ({
            e,
            a: Math.max(0, Math.round((+e.start - +s0) / 864e5)),
            b: Math.min(3, Math.round((+e.end - +s0) / 864e5)),
            before: e.start < s0,
            after: e.end > s3,
          }))
      : [];
    return { allDay, lanes: days.map((d) => ({ d, list: App.timedOn(d) })) };
  });
</script>

<div class="cal-day">
  <div class="cal-head3">
    <div></div>
    {#each days as d (+d)}
      <div class="cal-dh" class:is-today={App.sameDay(d, now)}>
        <span class="num">{d.getDate()}</span>
        <b>{App.fmt.rel(d)}</b>
        <small>{App.fmt.monthShort(d)}</small>
      </div>
    {/each}
  </div>
  {#if data.allDay.length}
    <div class="cal-allday">
      <div class="cal-gutter label">All day</div>
      <div class="cal-allday-grid">
        {#each data.allDay as a (a.e.id)}
          <button
            class="cal-ad"
            class:cont={a.before}
            style="grid-column:{a.a + 1} / {a.b + 1};{App.pstyle(App.evColor(a.e))}"
            onclick={() => onopen(a.e)}
            {@attach pressable}>
            {#if a.before}<Icon name="left" size={16} />{/if}
            {a.e.title}
            {#if a.after}<Icon name="right" size={16} />{/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
  <TimeGrid {days} {now} cols={3}>
    {#each data.lanes as l (+l.d)}
      <div class="cal-lane" class:is-today={App.sameDay(l.d, now)}>
        <Blocks list={l.list} day={l.d} {now} {onopen} {onmore} />
      </div>
    {/each}
  </TimeGrid>
</div>

<style>
  .cal-day { height: 100%; display: flex; flex-direction: column; position: relative; }
  .cal-head3 { display: grid; grid-template-columns: 64px repeat(3, 1fr); flex: none; }
  .cal-dh {
    display: flex;
    align-items: baseline;
    gap: 10px;
    padding: 0 14px 6px;
    margin: 0 4px;
    border-bottom: 5px solid var(--ink);
  }
  .cal-dh .num { font-size: 30px; line-height: 0.9; }
  .cal-dh b {
    font-size: 17px;
    font-weight: 800;
    font-stretch: 80%;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  .cal-dh small {
    margin-left: auto;
    font-size: var(--fs-min);
    color: var(--mute);
    font-weight: 700;
    text-transform: uppercase;
  }
  .cal-dh.is-today { background: var(--ink); color: var(--paper); border-radius: var(--r-s) var(--r-s) 0 0; padding-top: 8px; }
  .cal-dh.is-today small { color: inherit; opacity: 0.7; }
  .cal-allday {
    display: grid;
    grid-template-columns: 64px 1fr;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    flex: none;
  }
  .cal-gutter { font-size: 12px; padding-right: 6px; line-height: 1.1; }
  .cal-allday-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 8px; padding: 0 4px; }
  .cal-ad {
    min-height: 44px;
    padding: 0 14px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    gap: 6px;
    background: var(--c);
    color: var(--c-ink);
    font-size: 17px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    transition: transform 0.15s var(--ease);
  }
  .cal-ad:global(.is-pressed) { transform: scale(0.98); transition-duration: 0s; }
  .cont { border-top-left-radius: 0; border-bottom-left-radius: 0; }
  .cal-lane { position: relative; border-left: 1px solid var(--line); }
  .cal-lane.is-today { background: rgb(var(--ink-rgb) / 0.03); }
</style>

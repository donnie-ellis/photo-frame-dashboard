<script lang="ts">
  // Today view: one lane per person, family events across all lanes, all-day events on top.
  import { Icon, pressable } from '../../lib/ui';
  import { calendar, type CalEvent } from '../../lib/state/calendar.svelte';
  import TimeGrid from './TimeGrid.svelte';
  import Blocks from './Blocks.svelte';
  import EvBlock from './EvBlock.svelte';
  import { clampTop } from './layout';

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

  const data = $derived.by(() => {
    // Read only for the dependency: the helpers read window.DATA.events.
    calendar.events;
    const people = window.DATA.people;
    const s = App.dayStart(date);
    const timed = App.timedOn(date);
    return {
      people,
      allDay: App.allDayOn(date).map((e) => {
        const idx = people.findIndex((p) => p.id === e.people[0]);
        const span = Math.round((+e.end - +e.start) / 864e5);
        return {
          e,
          col: App.isFamily(e) ? '1 / -1' : `${idx + 1} / span 1`,
          cont: e.start < s,
          span,
          n: Math.round((+s - +e.start) / 864e5) + 1,
        };
      }),
      lanes: people.map((p) => ({ p, list: App.timedOn(date, p.id).filter((e) => !App.isFamily(e)) })),
      fam: timed.filter(App.isFamily),
      empty: !timed.length,
    };
  });
</script>

<div class="cal-day">
  {#if data.allDay.length}
    <div class="cal-allday">
      <div class="cal-gutter label">All day</div>
      <div class="cal-allday-grid" style:--cols={data.people.length}>
        {#each data.allDay as a (a.e.id)}
          <button
            class="cal-ad"
            class:cont={a.cont}
            style="grid-column:{a.col};{App.pstyle(App.evColor(a.e))}"
            onclick={() => onopen(a.e)}
            {@attach pressable}>
            {#if a.cont}<Icon name="left" size={16} />{/if}
            {a.e.title}
            {#if a.span > 1}<small>Day {a.n} of {a.span}</small>{/if}
          </button>
        {/each}
      </div>
    </div>
  {/if}
  <TimeGrid days={[date]} {now} cols={data.people.length}>
    {#each data.lanes as l (l.p.id)}
      <div class="cal-lane" style={App.pstyle(l.p)}>
        <Blocks list={l.list} day={date} lane={l.p.id} {now} {onopen} {onmore} />
      </div>
    {/each}
    <div class="cal-fam">
      {#each data.fam as e (e.id)}
        {@const b = clampTop(e, date)}
        <EvBlock {e} top={b.top} height={b.h} left="2px" width="calc(100% - 4px)" {now} {onopen} />
      {/each}
    </div>
  </TimeGrid>
  {#if data.empty}
    <div class="cal-empty serif">Nothing on the calendar.<br /><i>A rare, quiet day.</i></div>
  {/if}
</div>

<style>
  .cal-day { height: 100%; display: flex; flex-direction: column; position: relative; }
  .cal-allday {
    display: grid;
    grid-template-columns: 64px 1fr;
    align-items: center;
    padding: 10px 0;
    border-bottom: 1px solid var(--line);
    flex: none;
  }
  .cal-gutter { font-size: 12px; padding-right: 6px; line-height: 1.1; }
  .cal-allday-grid {
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 6px 8px;
    padding: 0 4px;
  }
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
  .cal-ad small { font-size: var(--fs-min); opacity: 0.75; font-weight: 600; margin-left: 4px; }
  .cont { border-top-left-radius: 0; border-bottom-left-radius: 0; }
  .cal-lane { position: relative; border-left: 1px solid var(--line); }
  .cal-fam { position: absolute; left: 0; right: 0; top: 0; bottom: 0; pointer-events: none; }
  .cal-fam :global(.cal-ev) { pointer-events: auto; }
  .cal-empty {
    position: absolute;
    left: 64px;
    right: 0;
    top: 45%;
    text-align: center;
    font-size: 48px;
    line-height: 1.05;
    color: var(--mute);
    pointer-events: none;
  }
</style>

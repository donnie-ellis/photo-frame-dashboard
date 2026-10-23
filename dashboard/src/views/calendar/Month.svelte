<script lang="ts">
  // Month grid, Sunday first, with one dot per event (up to five). Tapping a day opens it.
  import { pressable } from '../../lib/ui';
  import { calendar } from '../../lib/state/calendar.svelte';

  let {
    date,
    now,
    onday,
  }: {
    date: Date;
    now: Date;
    onday: (d: Date) => void;
  } = $props();
  const App = window.App;
  const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const cells = $derived.by(() => {
    // Read only for the dependency: the helpers read window.DATA.events.
    calendar.events;
    const first = new Date(date.getFullYear(), date.getMonth(), 1);
    const start = App.addDays(first, -first.getDay());
    return Array.from({ length: 42 }, (_, i) => {
      const d = App.addDays(start, i);
      const evs = [...App.allDayOn(d), ...App.timedOn(d)];
      return {
        d,
        out: d.getMonth() !== first.getMonth(),
        dots: evs.slice(0, 5).map((e) => ({ id: e.id, style: App.pstyle(App.evColor(e)), family: App.isFamily(e) })),
        more: evs.length - 5,
      };
    });
  });
</script>

<div class="cal-month">
  <div class="cal-dow">
    {#each DOW as d (d)}<span class="label">{d}</span>{/each}
  </div>
  <div class="cal-mgrid">
    {#each cells as c (+c.d)}
      <button
        class="cal-cell"
        class:is-out={c.out}
        class:is-today={App.sameDay(c.d, now)}
        onclick={() => onday(c.d)}
        {@attach pressable}>
        <span class="num">{c.d.getDate()}</span>
        <span class="cal-dots">
          {#each c.dots as dot (dot.id)}<i class:fam={dot.family} style={dot.style}></i>{/each}
          {#if c.more > 0}<em>+{c.more}</em>{/if}
        </span>
      </button>
    {/each}
  </div>
</div>

<style>
  .cal-month { height: 100%; display: flex; flex-direction: column; }
  .cal-dow { display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px; padding-bottom: 8px; }
  .cal-dow .label { padding-left: 12px; }
  .cal-mgrid {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    grid-template-rows: repeat(6, 1fr);
    gap: 6px;
  }
  .cal-cell {
    background: var(--card);
    border-radius: var(--r-s);
    padding: 8px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    text-align: left;
    transition: transform 0.15s var(--ease);
  }
  .cal-cell:global(.is-pressed) { transform: scale(0.97); transition-duration: 0s; }
  .cal-cell .num { font-size: 30px; line-height: 1; }
  .is-out { opacity: 0.35; }
  .is-today { background: var(--ink); color: var(--paper); }
  .cal-dots { display: flex; gap: 5px; flex-wrap: wrap; align-items: center; }
  .cal-dots i { width: 12px; height: 12px; border-radius: 50%; background: var(--c); }
  /* Family events are ink-coloured, which vanishes on today's ink cell. */
  .is-today .cal-dots i.fam { background: var(--paper); }
  .cal-dots em { font-style: normal; font-size: 13px; font-weight: 800; }
</style>

<script lang="ts">
  // Rolling 7 days of chores. Everyone: a person-by-day grid, tap a cell for the day's list. One
  // person: seven day columns. Today is live and checkable; days 1..6 are read-only.
  import { pressable } from '../../lib/ui';
  import { chores, compareChores, dayStart } from '../../lib/state/chores.svelte';
  import { upcoming } from '../../lib/state/upcoming.svelte';
  import { people } from '../../lib/state/people.svelte';
  import type { Person } from '../../lib/legacy.svelte';
  import ChoreRow from './ChoreRow.svelte';
  import { dayLabel } from './weekDays';

  let { now, person, onpick }: { now: Date; person: Person | null; onpick: (pid: string, day: number) => void } = $props();
  const App = window.App;

  const days = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dayStart(now));
      d.setDate(d.getDate() + i);
      return { i, key: +d, label: dayLabel(d, i) };
    }),
  );
  const ups = $derived(upcoming.byDay(now));
  const shown = $derived(person ? [person] : people.list);

  // Titles and counts per person and day. Day 0 is the person's whole Today lane.
  function cell(pid: string, i: number) {
    if (i === 0) {
      const rows = chores.list.filter((c) => c.who === pid).sort((a, b) => compareChores(a, b, now));
      return { titles: rows.map((c) => c.title), done: rows.filter((c) => c.done).length, total: rows.length };
    }
    const rows = (ups.get(i) ?? []).filter((c) => c.who === pid);
    return { titles: rows.map((c) => c.title), done: 0, total: rows.length };
  }
  const grid = $derived(shown.map((p) => ({ p, cells: days.map((d) => cell(p.id, d.i)) })));
  const rows0 = $derived(person ? chores.list.filter((c) => c.who === person.id).sort((a, b) => compareChores(a, b, now)) : []);
</script>

{#if !person}
  <div class="chr-wk" style:--rows={shown.length}>
    <div class="chr-wk-corner"></div>
    {#each days as d (d.key)}
      <div class="chr-wk-day" class:is-today={d.i === 0}>{d.label}</div>
    {/each}
    {#each grid as row (row.p.id)}
      <div class="chr-wk-who" style={App.pstyle(row.p)}>{row.p.name}</div>
      {#each row.cells as c, i (days[i].key)}
        {#if c.total}
          <button class="chr-wk-cell" style={App.pstyle(row.p)} onclick={() => onpick(row.p.id, i)} {@attach pressable}>
            {#each c.titles.slice(0, 2) as t, ti (ti)}<span class="chr-wk-t">{t}</span>{/each}
            {#if c.titles.length > 2}<span class="chr-wk-more">+{c.titles.length - 2}</span>{/if}
            {#if i === 0}<span class="chr-wk-more">{c.done}/{c.total} done</span>{/if}
          </button>
        {:else}
          <div class="chr-wk-empty"></div>
        {/if}
      {/each}
    {/each}
  </div>
{:else}
  <div class="chr-wk-cols">
    {#each days as d (d.key)}
      {@const list = d.i === 0 ? [] : (ups.get(d.i) ?? []).filter((c) => c.who === person.id)}
      <section class="chr-wk-col" style={App.pstyle(person)}>
        <header class="chr-wk-colhead" class:is-today={d.i === 0}>{d.label}</header>
        <div class="chr-wk-list">
          {#if d.i === 0}
            {#each rows0 as c (c.id)}
              <ChoreRow chore={c} {now} pending={chores.pending.has(c.id)} compact />
            {:else}
              <div class="chr-wk-none"><i>Nothing</i></div>
            {/each}
          {:else}
            {#each list as c (c.id)}
              <div class="chr-wk-item">
                <b>{c.title}</b>
                <small>{c.allDay ? 'All day' : App.fmt.time(c.due)}</small>
              </div>
            {:else}
              <div class="chr-wk-none"><i>Nothing</i></div>
            {/each}
          {/if}
        </div>
      </section>
    {/each}
  </div>
{/if}

<style>
  .chr-wk {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: 110px repeat(7, 1fr);
    grid-template-rows: auto repeat(var(--rows), 1fr);
    gap: 6px;
  }
  .chr-wk-day {
    align-self: end;
    padding: 0 4px 2px;
    text-align: center;
    font-size: var(--fs-label);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mute);
  }
  .chr-wk-day.is-today { color: var(--ink); }
  .chr-wk-who {
    display: grid;
    align-items: center;
    padding: 0 10px;
    border-radius: var(--r-s);
    background: var(--c);
    color: var(--c-ink);
    font-size: var(--fs-body);
    font-weight: 800;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chr-wk-cell {
    min-width: 0;
    min-height: var(--tap);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 2px;
    padding: 6px 8px;
    border-radius: var(--r-s);
    text-align: left;
    background: var(--c);
    color: var(--c-ink);
    overflow: hidden;
    transition: transform 0.15s var(--ease);
  }
  .chr-wk-cell:global(.is-pressed) { transform: scale(0.96); transition-duration: 0s; }
  .chr-wk-t {
    font-size: var(--fs-min);
    font-weight: 700;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chr-wk-more { font-size: var(--fs-min); font-weight: 800; opacity: 0.85; }
  .chr-wk-empty { min-height: var(--tap); border-radius: var(--r-s); background: var(--card); }

  .chr-wk-cols {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 8px;
  }
  .chr-wk-col {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: var(--r);
    overflow: hidden;
  }
  .chr-wk-colhead {
    flex: none;
    padding: 12px 8px;
    text-align: center;
    background: var(--paper-2);
    color: var(--ink-2);
    font-size: var(--fs-label);
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .chr-wk-colhead.is-today { background: var(--c); color: var(--c-ink); }
  .chr-wk-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 8px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chr-wk-item {
    flex: none;
    display: flex;
    flex-direction: column;
    padding: 8px 10px;
    border-radius: var(--r-s);
    background: var(--paper);
  }
  .chr-wk-item b { font-size: var(--fs-body); font-weight: 700; line-height: 1.15; overflow-wrap: anywhere; }
  .chr-wk-item small { font-size: var(--fs-min); font-weight: 600; color: var(--mute); }
  .chr-wk-none { padding: 24px 0; text-align: center; color: var(--mute); font-size: var(--fs-body); }
</style>

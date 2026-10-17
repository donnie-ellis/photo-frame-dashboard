<script lang="ts">
  // Chores from Reminders: one lane per person. Overdue first, then today, then undated, done last.
  // Tap to check off (undo toast). Adding chores and stars have no contract endpoint.
  import type { ViewProps } from '../../lib/legacy.svelte';
  import { Chip, StaleBadge } from '../../lib/ui';
  import { fade } from 'svelte/transition';
  import { chores, compareChores, isDueNow } from '../../lib/state/chores.svelte';
  import { people } from '../../lib/state/people.svelte';
  import { personFilter } from '../../lib/state/personFilter.svelte';
  import ChoreRow from './ChoreRow.svelte';

  let { active }: ViewProps = $props();
  const App = window.App;

  let now = $state.raw(App.now());

  // A minute tick while shown, so "overdue" tracks the clock. The feed itself is live from main.ts.
  $effect(() => {
    if (!active) return;
    const tick = () => (now = App.now());
    tick();
    App.on('minute', tick);
    App.on('time', tick);
    return () => {
      App.off('minute', tick);
      App.off('time', tick);
    };
  });

  // Back to Everyone when the view is left.
  $effect(() => {
    if (!active) personFilter.reset();
  });

  // Chores whose person isn't in the people list have no lane and are left out.
  const lanes = $derived(
    people.list.map((p) => {
      const rows = chores.list.filter((c) => c.who === p.id).sort((a, b) => compareChores(a, b, now));
      return {
        p,
        rows,
        done: rows.filter((c) => c.done).length,
        due: rows.filter((c) => isDueNow(c, now)).length,
      };
    }),
  );
  const person = $derived(personFilter.person);
  const shown = $derived(person ? lanes.filter((l) => l.p.id === person.id) : lanes);
  const total = $derived(shown.reduce((n, l) => n + l.rows.length, 0));
  const open = $derived(shown.reduce((n, l) => n + l.rows.length - l.done, 0));
</script>

<div class="chr">
  <header class="chr-head">
    <div class="chr-title">
      <div class="label">Today</div>
      {#if person}
        <h1 class="serif chr-who" style={App.pstyle(person)}>{person.name}’s chores</h1>
      {:else}
        <h1 class="serif">Chores</h1>
      {/if}
    </div>
    <div class="chr-count"><span class="num">{open}</span> to do · {total - open} done</div>
    <StaleBadge status={chores.status} />
  </header>

  <div class="chr-chips">
    <Chip tall selected={!person} onclick={() => personFilter.select(null)}>Everyone</Chip>
    {#each lanes as lane (lane.p.id)}
      <Chip tint={App.pstyle(lane.p)} selected={person?.id === lane.p.id} onclick={() => personFilter.select(lane.p.id)}>
        <span class="chr-chip"><b>{lane.p.name}</b><small>{lane.due} to do</small></span>
      </Chip>
    {/each}
  </div>

  {#key person?.id ?? 'all'}
    <div class="chr-lanes" style:--cols={shown.length} in:fade={{ duration: 180 }}>
      {#each shown as lane (lane.p.id)}
        <section class="chr-lane" style={App.pstyle(lane.p)}>
          <header class="chr-lane-head">
            <b>{lane.p.name}</b>
            <span class="chr-lane-sub">{lane.rows.length ? `${lane.done} of ${lane.rows.length}` : 'Nothing'}</span>
          </header>
          <div class="chr-list" class:is-wide={!!person} style:--rcols={lane.rows.length > 8 ? 3 : 2}>
            {#each lane.rows as c (c.id)}
              <ChoreRow chore={c} {now} pending={chores.pending.has(c.id)} />
            {:else}
              <div class="chr-none serif"><i>Nothing to do</i></div>
            {/each}
          </div>
        </section>
      {/each}
    </div>
  {/key}
</div>

<style>
  .chr { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--gap); }
  .chr-head { flex: none; display: flex; align-items: center; gap: var(--pad); }
  .chr-title h1 { font-size: var(--fs-hero); line-height: 0.95; }
  .chr-who { color: var(--c); }
  .chr-chips { flex: none; display: flex; flex-wrap: wrap; align-items: center; gap: 12px; }
  .chr-chip { display: flex; flex-direction: column; align-items: flex-start; line-height: 1.1; }
  .chr-chip small { font-size: var(--fs-min); font-weight: 700; opacity: 0.85; }
  .chr-count { margin-right: auto; font-size: var(--fs-m); color: var(--mute); padding-top: var(--pad); }
  .chr-count .num { font-size: var(--fs-l); color: var(--ink); }

  .chr-lanes {
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: repeat(var(--cols), 1fr);
    gap: 12px;
  }
  .chr-lane {
    min-width: 0;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: var(--r);
    overflow: hidden;
  }
  .chr-lane-head {
    flex: none;
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px 14px;
    background: var(--c);
    color: var(--c-ink);
  }
  .chr-lane-head b {
    font-size: var(--fs-m);
    font-weight: 800;
    font-stretch: 70%;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .chr-lane-sub { font-size: var(--fs-min); font-weight: 700; opacity: 0.85; }
  .chr-list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: 10px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .chr-list.is-wide {
    display: grid;
    grid-template-columns: repeat(var(--rcols), 1fr);
    align-content: start;
  }
  .chr-none { padding: 40px 0; text-align: center; font-size: var(--fs-l); color: var(--mute); }
</style>

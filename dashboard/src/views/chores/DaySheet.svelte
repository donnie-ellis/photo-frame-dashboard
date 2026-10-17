<script lang="ts">
  // One person's chores for one day of the Week grid. Today is checkable; later days are read-only.
  import { Sheet } from '../../lib/ui';
  import { chores, compareChores } from '../../lib/state/chores.svelte';
  import { upcoming } from '../../lib/state/upcoming.svelte';
  import { people } from '../../lib/state/people.svelte';
  import ChoreRow from './ChoreRow.svelte';
  import { dayLabel } from './weekDays';

  let { pick, now, onclose }: { pick: { pid: string; day: number } | null; now: Date; onclose: () => void } = $props();
  const App = window.App;

  // Keep the last pick while the sheet fades out.
  let shown = $state.raw<{ pid: string; day: number } | null>(null);
  $effect(() => {
    if (pick) shown = pick;
  });
  const open = $derived(pick !== null);
  const p = $derived(shown ? people.list.find((x) => x.id === shown!.pid) : undefined);
  const date = $derived.by(() => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + (shown?.day ?? 0));
    return d;
  });
  const todayRows = $derived(
    shown && shown.day === 0 ? chores.list.filter((c) => c.who === shown!.pid).sort((a, b) => compareChores(a, b, now)) : [],
  );
  const laterRows = $derived(
    shown && shown.day > 0 ? (upcoming.byDay(now).get(shown.day) ?? []).filter((c) => c.who === shown!.pid) : [],
  );
</script>

<Sheet {open} {onclose}>
  {#if shown && p}
    <div class="chr-ds" style={App.pstyle(p)}>
      <header class="chr-ds-head">
        <b>{p.name}</b>
        <span>{dayLabel(date, shown.day)}</span>
      </header>
      <div class="chr-ds-body">
        {#if shown.day === 0}
          {#each todayRows as c (c.id)}
            <ChoreRow chore={c} {now} pending={chores.pending.has(c.id)} />
          {:else}
            <div class="chr-ds-none"><i>Nothing</i></div>
          {/each}
        {:else}
          {#each laterRows as c (c.id)}
            <div class="chr-ds-item">
              <b>{c.title}</b>
              <small>{c.allDay ? 'All day' : App.fmt.time(c.due)}</small>
              {#if c.notes}<small>{c.notes}</small>{/if}
            </div>
          {:else}
            <div class="chr-ds-none"><i>Nothing</i></div>
          {/each}
        {/if}
      </div>
    </div>
  {/if}
</Sheet>

<style>
  .chr-ds-head {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 24px 80px 20px 24px;
    background: var(--c);
    color: var(--c-ink);
  }
  .chr-ds-head b { font-size: var(--fs-l); font-weight: 800; }
  .chr-ds-head span { font-size: var(--fs-m); font-weight: 700; opacity: 0.9; }
  .chr-ds-body { display: flex; flex-direction: column; gap: 8px; padding: 16px; }
  .chr-ds-item {
    display: flex;
    flex-direction: column;
    padding: 10px 12px;
    border-radius: var(--r-s);
    background: var(--card);
  }
  .chr-ds-item b { font-size: var(--fs-body); font-weight: 700; }
  .chr-ds-item small { font-size: var(--fs-min); font-weight: 600; color: var(--mute); }
  .chr-ds-none { padding: 32px 0; text-align: center; color: var(--mute); font-size: var(--fs-l); }
</style>

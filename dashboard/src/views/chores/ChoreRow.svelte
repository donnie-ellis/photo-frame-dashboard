<script lang="ts">
  // One chore: a big tap target that checks it off (or puts it back). Overdue gets an alert edge.
  import { Icon, pressable } from '../../lib/ui';
  import { chores, choreState, type ChoreItem } from '../../lib/state/chores.svelte';

  let { chore, now, pending }: { chore: ChoreItem; now: Date; pending: boolean } = $props();

  const state = $derived(choreState(chore, now));
  const when = $derived(
    state === 'overdue'
      ? 'Overdue'
      : state === 'today' && chore.due
        ? chore.allDay
          ? 'Today'
          : window.App.fmt.time(chore.due)
        : '',
  );
</script>

<button
  class="chr-row"
  class:is-overdue={state === 'overdue'}
  class:is-today={state === 'today'}
  class:is-done={state === 'done'}
  class:is-pending={pending}
  onclick={() => chores.toggle(chore.id)}
  {@attach pressable}>
  <span class="chr-box"><Icon name="check" size={22} /></span>
  <span class="chr-text">
    <b>{chore.title}</b>
    {#if when}<small class="chr-when">{when}</small>{/if}
    {#if chore.notes}<small class="chr-notes">{chore.notes}</small>{/if}
  </span>
</button>

<style>
  .chr-row {
    flex: none;
    width: 100%;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px 8px 8px;
    border-radius: var(--r-s);
    text-align: left;
    background: var(--paper);
    transition: transform 0.15s var(--ease);
  }
  .chr-row:global(.is-pressed) { transform: scale(0.97); transition-duration: 0s; }
  .chr-row.is-today { background: rgb(var(--c-rgb) / 0.12); }
  .chr-row.is-overdue { box-shadow: inset 0 0 0 2px var(--alert); }
  .chr-row.is-pending { opacity: 0.6; }
  .chr-row.is-done { color: var(--mute); }

  .chr-box {
    width: 36px;
    height: 36px;
    border-radius: var(--r-s);
    flex: none;
    display: grid;
    place-items: center;
    color: transparent;
    box-shadow: inset 0 0 0 3px var(--line);
  }
  .chr-row.is-done .chr-box { background: var(--c); color: var(--c-ink); box-shadow: none; }
  .chr-text { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .chr-text b {
    font-size: var(--fs-body);
    font-weight: 700;
    line-height: 1.15;
    overflow-wrap: anywhere;
  }
  .chr-row.is-done .chr-text b { text-decoration: line-through; text-decoration-thickness: 2px; }
  .chr-text small { font-size: var(--fs-min); font-weight: 600; color: var(--mute); }
  .chr-text .chr-when { font-variant-numeric: tabular-nums; }
  .chr-row.is-overdue .chr-when { color: var(--alert); font-weight: 800; }
  .chr-text .chr-notes { font-weight: 500; }
</style>

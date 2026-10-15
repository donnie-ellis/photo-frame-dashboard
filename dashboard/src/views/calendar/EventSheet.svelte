<script lang="ts">
  // Read-only event details: when, leave-by, where, who, notes.
  import { Icon, Sheet } from '../../lib/ui';
  import { closeEvent, openedEvent } from './openEvent.svelte';
  import type { CalEvent } from '../../lib/state/calendar.svelte';

  const App = window.App;

  // Keep the last event while the sheet fades out.
  let shown = $state.raw<CalEvent | null>(null);
  $effect(() => {
    const e = openedEvent();
    if (e) shown = e;
  });
  const open = $derived(openedEvent() !== null);
  const ev = $derived(shown);
  const people = $derived(ev ? (App.isFamily(ev) ? window.DATA.people : ev.people.map(App.person)) : []);
</script>

<Sheet {open} onclose={closeEvent}>
  {#if ev}
    <div class="cal-evs" style={App.pstyle(App.evColor(ev))}>
      <div class="cal-band">
        <div class="label label--on">{App.fmt.rel(ev.start)} · {App.fmt.month(ev.start)} {ev.start.getDate()}</div>
        <h2 class="serif">{ev.title}</h2>
        <div class="cal-when num">{ev.allDay ? 'All day' : App.fmt.range(ev.start, ev.end)}</div>
      </div>
      <div class="cal-body">
        {#if ev.travel}
          <div class="cal-row">
            <Icon name="car" size={28} />
            <div><b>Leave by {App.fmt.time(App.leaveBy(ev))}</b><span class="cal-sub">{ev.travel} min drive in current traffic</span></div>
          </div>
        {/if}
        {#if ev.loc}
          <div class="cal-row">
            <Icon name="pin" size={28} />
            <div><b>{ev.loc}</b></div>
          </div>
        {/if}
        <div class="cal-row">
          <Icon name="person" size={28} />
          <div class="cal-people">
            {#each people as p (p.id)}
              <span class="cal-who" style={App.pstyle(p)}>
                <span class="avatar cal-av">{p.id === 'family' ? '★' : p.name[0]}</span>{p.name}
              </span>
            {/each}
          </div>
        </div>
        {#if ev.notes}<div class="cal-notes serif">“{ev.notes}”</div>{/if}
      </div>
    </div>
  {/if}
</Sheet>

<style>
  .cal-band { background: var(--c); color: var(--c-ink); padding: 34px 36px 30px; }
  .cal-band h2 { font-size: 68px; line-height: 0.95; margin: 8px 0 12px; padding-right: 50px; }
  .cal-when { font-size: 36px; }
  .cal-body { padding: 18px 36px 32px; }
  .cal-row {
    display: flex;
    align-items: center;
    gap: 18px;
    min-height: 76px;
    border-bottom: 1px solid var(--line);
  }
  .cal-row > div { display: flex; flex-direction: column; }
  .cal-row b { font-size: 21px; font-weight: 700; }
  .cal-sub { font-size: 16px; color: var(--mute); }
  .cal-row > .cal-people { flex-direction: row; flex-wrap: wrap; gap: 8px; padding: 10px 0; }
  .cal-who {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-height: 48px;
    padding: 0 18px 0 8px;
    border-radius: 999px;
    background: rgb(var(--c-rgb) / 0.14);
    font-size: var(--fs-body);
    font-weight: 700;
    color: var(--ink);
  }
  .cal-who .cal-av { width: 32px; height: 32px; font-size: 15px; color: var(--c-ink); }
  .cal-notes { font-size: 28px; line-height: 1.2; padding-top: 22px; font-style: italic; }
</style>

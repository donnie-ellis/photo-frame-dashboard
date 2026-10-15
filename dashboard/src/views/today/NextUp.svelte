<script lang="ts">
  // The next event someone has to act on (earliest leave-by), or a quiet-day card.
  import { Icon, pressable } from '../../lib/ui';
  import { calendar } from '../../lib/state/calendar.svelte';
  import { openEvent } from '../calendar/openEvent.svelte';

  let { now }: { now: Date } = $props();
  const App = window.App;

  const next = $derived.by(() => {
    // Read only for the dependency: the helpers below read window.DATA.events.
    calendar.events;
    const e = App.nextEvent();
    return { e, tomorrow: e ? undefined : App.timedOn(App.addDays(now, 1))[0] };
  });

  const e = $derived(next.e);
  const mins = $derived(e ? (+e.start - +now) / 60000 : 0);
  const leave = $derived(e ? (+App.leaveBy(e) - +now) / 60000 : 0);
  const who = $derived(e ? (App.isFamily(e) ? 'Everyone' : e.people.map((id) => App.person(id).name).join(' + ')) : '');
</script>

{#if e}
  <button class="td-hero" style={App.pstyle(App.evColor(e))} onclick={() => openEvent(App.findEvent(e.id))} {@attach pressable}>
    <span class="td-hero-main">
      <span class="label label--on">Next up · {who}</span>
      <span class="td-hero-title serif">{e.title}</span>
      <span class="td-hero-meta">{App.fmt.range(e.start, e.end)}{e.loc ? ' · ' + e.loc : ''}</span>
      <span class="td-hero-foot">
        {#if e.people.length > 1}
          <span class="dots">
            {#each e.people as id (id)}<i style="{App.pstyle(id)};width:22px;height:22px"></i>{/each}
          </span>
        {/if}
        {#if e.travel}
          {#if leave <= 0}
            <span class="pill pill--alert"><i class="pulse"></i>Leave now</span>
          {:else}
            <span class="pill" class:pill--soon={leave <= 15}><Icon name="car" size={20} />Leave in {App.fmt.mins(leave)}</span>
          {/if}
        {/if}
      </span>
    </span>
    {#if mins < 100}
      <span class="td-hero-count num">{Math.round(mins)}<small>min</small></span>
    {:else}
      <span class="td-hero-count num">{App.fmt.time(e.start, false)}<small>{App.fmt.ampm(e.start)}</small></span>
    {/if}
  </button>
{:else}
  <button class="td-hero td-hero--empty" onclick={() => App.go('calendar')} {@attach pressable}>
    <span class="label label--light">Rest of today</span>
    <span class="td-hero-title serif">Nothing else scheduled.<br /><i>Enjoy the quiet.</i></span>
    {#if next.tomorrow}
      <span class="td-hero-meta">Tomorrow starts with <b>{next.tomorrow.title}</b> at {App.fmt.time(next.tomorrow.start)}</span>
    {/if}
  </button>
{/if}

<style>
  .td-hero {
    display: flex;
    align-items: stretch;
    gap: 20px;
    width: 100%;
    height: 100%;
    text-align: left;
    background: var(--c);
    color: var(--c-ink);
    border-radius: var(--r);
    padding: 22px 26px;
    overflow: hidden;
    transition: transform 0.15s var(--ease);
  }
  .td-hero:global(.is-pressed) { transform: scale(0.985); transition-duration: 0s; }
  .td-hero-main { flex: 1; display: flex; flex-direction: column; min-width: 0; --bg: var(--c); }
  .td-hero-title {
    display: block;
    font-size: 72px;
    line-height: 0.95;
    margin: 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .td-hero-meta { font-size: var(--fs-body); opacity: 0.88; }
  .td-hero-foot { margin-top: auto; display: flex; align-items: center; gap: 14px; }
  .td-hero-foot .dots i { box-shadow: 0 0 0 3px var(--bg); }
  .td-hero-count {
    font-size: var(--fs-clock);
    line-height: 0.78;
    letter-spacing: -0.04em;
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    justify-content: center;
  }
  .td-hero-count small {
    font-size: 22px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    font-stretch: 80%;
    margin-top: 10px;
  }
  .td-hero--empty { background: var(--ink); color: var(--paper); flex-direction: column; justify-content: center; gap: 0; }
  .td-hero--empty .td-hero-title { white-space: normal; font-size: 56px; }
</style>

<script lang="ts">
  // Now, today's range and the next seven hours. Recomputed on the hour (hourKey) and when the feed changes.
  import { Icon } from '../../lib/ui';
  import { weather } from '../../lib/state/weather.svelte';

  let { hourKey }: { hourKey: string } = $props();

  const view = $derived.by(() => {
    // Read only for the dependency: the helpers below read window.DATA.weather.
    weather.data;
    hourKey;
    const hours = window.App.hourly(7);
    const ts = hours.map((h) => h.t);
    return { w: window.App.weatherNow(), hours, tmin: Math.min(...ts), tmax: Math.max(...ts) };
  });

  function lift(t: number): number {
    return view.tmax === view.tmin ? 0 : Math.round(((t - view.tmin) / (view.tmax - view.tmin)) * 8);
  }
</script>

<div class="td-wx">
  <div class="td-wx-top">
    <Icon name={view.w.cond} size={60} />
    <span class="td-wx-temp num">{view.w.temp}°</span>
    <span class="td-wx-meta"><b>{view.w.label}</b><span>H {view.w.hi}°  L {view.w.lo}°</span></span>
  </div>
  <div class="td-wx-say"><b>{view.w.summary}.</b> {view.w.advice}.</div>
  <div class="td-wx-hours">
    {#each view.hours as h (h.h)}
      <div class="td-hr" class:is-wet={h.p >= 50}>
        <span class="td-hr-l">{h.label}</span>
        <span class="td-hr-i" style:transform="translateY({-lift(h.t)}px)"><Icon name={h.c} size={22} /></span>
        <b>{h.t}°</b>
      </div>
    {/each}
  </div>
</div>

<style>
  .td-wx {
    height: 100%;
    border-bottom: 3px solid var(--ink);
    padding: 0 8px 6px;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .td-wx-top { display: flex; align-items: center; gap: 10px; }
  .td-wx-temp { font-size: 84px; line-height: 0.8; letter-spacing: -0.03em; }
  .td-wx-meta { display: flex; flex-direction: column; font-size: 17px; min-width: 0; }
  .td-wx-meta b {
    font-weight: 800;
    font-stretch: 80%;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: var(--fs-label);
    white-space: nowrap;
  }
  .td-wx-meta span { color: var(--mute); font-variant-numeric: tabular-nums; white-space: pre; }
  .td-wx-say {
    font-family: var(--serif);
    font-size: 22px;
    line-height: 1.15;
    margin: 8px 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .td-wx-say b { font-weight: 400; font-style: italic; }
  .td-wx-hours { display: grid; grid-template-columns: repeat(7, 1fr); }
  .td-hr { display: flex; flex-direction: column; align-items: center; gap: 1px; font-size: 16px; }
  .td-hr-l { font-size: var(--fs-min); font-weight: 700; color: var(--mute); text-transform: uppercase; }
  .td-hr-i { height: 26px; display: grid; place-items: center; }
  .td-hr b { font-weight: 800; font-stretch: 70%; }
  .td-hr.is-wet .td-hr-i { color: var(--wet); }
</style>

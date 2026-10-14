<script lang="ts">
  import { pressable } from '../../lib/ui';

  let { now }: { now: Date } = $props();
  const App = window.App;
</script>

<button class="td-ck" onclick={() => App.go('calendar')} {@attach pressable}>
  <span class="td-time num">{App.fmt.time(now, false)}<span class="td-ampm">{App.fmt.ampm(now)}</span></span>
  <span class="td-date"><b>{App.fmt.day(now)}</b> {App.fmt.month(now)} {now.getDate()}</span>
</button>

<style>
  .td-ck {
    width: 100%;
    height: 100%;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
    align-items: flex-start;
    text-align: left;
    padding-bottom: 6px;
    border-bottom: 3px solid var(--ink);
    transition: transform 0.15s var(--ease);
  }
  .td-ck:global(.is-pressed) { transform: scale(0.985); transition-duration: 0s; }
  .td-time { font-size: var(--fs-clock); line-height: 0.78; letter-spacing: -0.035em; display: flex; align-items: flex-start; }
  .td-ampm { font-size: 28px; font-weight: 800; letter-spacing: 0.06em; margin: 6px 0 0 10px; }
  .td-date { font-size: var(--fs-m); margin-top: 14px; font-family: var(--serif); }
  .td-date b {
    font-family: var(--sans);
    font-weight: 800;
    font-stretch: 75%;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    font-size: var(--fs-body);
    margin-right: 6px;
  }
</style>

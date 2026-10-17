<script lang="ts">
  // Today: the glanceable overview. Fixed 1136 x 752 grid, never scrolls. Read-only except the
  // shopping and chore check-offs and the room's light switches.
  import { untrack } from 'svelte';
  import type { ViewProps } from '../../lib/legacy.svelte';
  import { lights } from '../../lib/state/lights.svelte';
  import { nowPlaying } from '../../lib/state/nowplaying.svelte';
  import Clock from './Clock.svelte';
  import Weather from './Weather.svelte';
  import LightsCard from './LightsCard.svelte';
  import NextUp from './NextUp.svelte';
  import Lanes from './Lanes.svelte';
  import PhotoTile from './PhotoTile.svelte';
  import ShoppingCard from './ShoppingCard.svelte';
  import NowPlayingTile from './NowPlayingTile.svelte';

  let { active }: ViewProps = $props();

  let now = $state.raw(window.App.now());
  // Weather and the lanes only need to change on the hour.
  const hourKey = $derived(`${now.getMonth()}-${now.getDate()}-${now.getHours()}`);

  // Every minute (and when the demo clock jumps) while visible.
  $effect(() => {
    if (!active) return;
    const tick = () => (now = window.App.now());
    tick();
    window.App.on('minute', tick);
    window.App.on('time', tick);
    return () => {
      window.App.off('minute', tick);
      window.App.off('time', tick);
    };
  });

  $effect(() => {
    if (!active) return;
    untrack(() => lights.activate());
    return () => lights.deactivate();
  });

  $effect(() => {
    if (!active) return;
    untrack(() => nowPlaying.activate());
    return () => nowPlaying.deactivate();
  });
</script>

<div class="td">
  <div class="td-clock"><Clock {now} /></div>
  <div class="td-weather"><Weather {hourKey} /></div>
  <div class="td-lights"><LightsCard /></div>
  <div class="td-main">
    <NextUp {now} />
    <Lanes {now} />
  </div>
  <div class="td-side">
    {#if nowPlaying.showing}
      <NowPlayingTile />
    {:else}
      <PhotoTile {active} />
    {/if}
    <ShoppingCard />
  </div>
</div>

<style>
  .td {
    height: 100%;
    display: grid;
    grid-template-columns: repeat(12, 1fr);
    grid-template-rows: 184px 1fr;
    gap: var(--gap);
  }
  .td-clock { grid-column: 1 / 5; min-width: 0; }
  .td-weather { grid-column: 5 / 9; min-width: 0; }
  .td-lights { grid-column: 9 / 13; min-width: 0; min-height: 0; }
  .td-main {
    grid-column: 1 / 8;
    display: grid;
    grid-template-rows: 232px 1fr;
    gap: var(--gap);
    min-height: 0;
    min-width: 0;
  }
  .td-side {
    grid-column: 8 / 13;
    display: grid;
    grid-template-rows: 1fr 250px;
    gap: var(--gap);
    min-height: 0;
    min-width: 0;
  }
</style>

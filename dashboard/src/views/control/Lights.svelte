<script lang="ts">
  import { untrack } from 'svelte';
  import { Button, Chip, Icon, Sheet, SliderTile, StaleBadge } from '../../lib/ui';
  import type { ViewProps } from '../../lib/legacy.svelte';
  import { lights } from '../../lib/state/lights.svelte';
  import RoomPicker from './RoomPicker.svelte';
  import LightSheet from './LightSheet.svelte';

  let { active }: ViewProps = $props();

  // A room opened from "All rooms" without making it the frame's room.
  let browsing = $state<string | null>(null);
  let listOpen = $state(false);
  // The light whose colour and white sheet is open.
  let moreId = $state<string | null>(null);
  const moreOpen = $derived(moreId !== null && lights.devices.some((l) => l.id === moreId));

  const home = $derived(lights.defaultRoom);
  const room = $derived(lights.rooms.find((r) => r.id === browsing) ?? home);
  const members = $derived(room ? lights.lightsOf(room) : []);
  const scenes = $derived(room ? lights.scenesOf(room.id) : []);
  const away = $derived(!!room && !!home && room.id !== home.id);

  $effect(() => {
    if (!active) return;
    untrack(() => lights.activate());
    return () => lights.deactivate();
  });

  function browse(id: string) {
    browsing = id === home?.id ? null : id;
    listOpen = false;
  }

  function makeHome() {
    if (!room) return;
    lights.setDefaultRoom(room.id);
    browsing = null;
  }

  function dim(set: (patch: { on: boolean } | { level: number }) => void, level: number) {
    set(level === 0 ? { on: false } : { level });
  }
</script>

<div class="lv">
  {#if !room}
    <header class="lv-head">
      <h1 class="serif lv-title">Which room is this frame in?</h1>
      <StaleBadge status={lights.status} />
    </header>
    <div class="lv-scroll">
      <RoomPicker mode="pick" onpick={(id) => lights.setDefaultRoom(id)} />
    </div>
  {:else}
    <header class="lv-head">
      <h1 class="serif lv-title">{room.name}</h1>
      <StaleBadge status={lights.status} />
      <div class="lv-actions">
        {#if away}
          <Button icon="undo" onclick={() => (browsing = null)}>Back to {home?.name}</Button>
          <Button icon="check" onclick={makeHome}>Make this the frame’s room</Button>
        {/if}
        <Button icon="home" onclick={() => (listOpen = true)}>All rooms</Button>
      </div>
    </header>

    <div class="lv-top">
      <div class="lv-room">
        <SliderTile
          size="l"
          icon={room.kind === 'zone' ? 'home' : 'bulb'}
          name={room.name}
          on={room.on}
          level={room.level}
          pending={lights.pending.has(room.id)}
          ontoggle={() => lights.setRoom(room.id, { on: !room.on })}
          onlevel={(l) => dim((p) => lights.setRoom(room.id, p), l)} />
      </div>
      <div class="lv-scenes">
        {#each scenes as s (s.id)}
          <Chip selected={s.active} onclick={() => lights.recall(s.id)}>
            <Icon name={s.icon ?? 'bulb'} size={22} />{s.name}
          </Chip>
        {/each}
      </div>
    </div>

    <div class="lv-scroll">
      <div class="lv-tiles">
        {#each members as l (l.id)}
          <SliderTile
            name={l.name}
            on={l.on}
            level={l.level}
            pending={lights.pending.has(l.id)}
            color={l.color}
            onmore={l.tempRange || l.color ? () => (moreId = l.id) : undefined}
            moreLabel="{l.name} colour and white"
            ontoggle={() => lights.setLight(l.id, { on: !l.on })}
            onlevel={(lvl) => dim((p) => lights.setLight(l.id, p), lvl)} />
        {/each}
      </div>
    </div>
  {/if}
</div>

<Sheet bind:open={listOpen}>
  <div class="lv-sheet">
    <h2 class="serif lv-sheet-title">All rooms</h2>
    <RoomPicker mode="browse" current={room?.id} onpick={browse} />
  </div>
</Sheet>

<Sheet open={moreOpen} onclose={() => (moreId = null)}>
  {#if moreId}<LightSheet id={moreId} />{/if}
</Sheet>

<style>
  .lv { height: 100%; display: flex; flex-direction: column; gap: var(--gap); min-height: 0; }
  .lv-head { display: flex; align-items: center; gap: var(--gap); flex: none; }
  .lv-title { font-size: var(--fs-xl); line-height: 1; margin: 0; }
  .lv-actions { margin-left: auto; display: flex; gap: 10px; }
  .lv-top { display: flex; align-items: center; gap: 20px; flex: none; }
  .lv-room { width: 360px; flex: none; }
  .lv-scenes { display: flex; flex-wrap: wrap; gap: 10px; }
  .lv-scroll { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: 24px; }
  .lv-tiles { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  .lv-sheet { padding: 34px 36px 32px; }
  .lv-sheet-title { font-size: 52px; line-height: 1; margin: 6px 0 14px; }
</style>

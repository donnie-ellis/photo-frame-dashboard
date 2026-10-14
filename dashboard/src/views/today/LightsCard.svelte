<script lang="ts">
  // The frame's room: switch the room or one of its lights. Dimming and scenes are in Home control.
  import { Button, Icon, StaleBadge, ToggleTile, pressable } from '../../lib/ui';
  import { lights } from '../../lib/state/lights.svelte';

  const App = window.App;
  const room = $derived(lights.defaultRoom);
  const members = $derived(room ? lights.lightsOf(room) : []);
</script>

<div class="td-lc">
  {#if room}
    <button class="td-lc-head" onclick={() => App.go('control')} {@attach pressable}>
      <Icon name={room.kind === 'zone' ? 'home' : 'bulb'} size={24} />
      <span class="td-lc-name">{room.name}</span>
      <StaleBadge status={lights.status} />
    </button>
    <div class="td-lc-tiles">
      <ToggleTile
        name="All"
        icon={room.kind === 'zone' ? 'home' : 'bulb'}
        on={room.on}
        pending={lights.pending.has(room.id)}
        ontoggle={() => lights.setRoom(room.id, { on: !room.on })} />
      {#each members as l (l.id)}
        <ToggleTile
          name={l.name}
          on={l.on}
          pending={lights.pending.has(l.id)}
          ontoggle={() => lights.setLight(l.id, { on: !l.on })} />
      {/each}
    </div>
  {:else}
    <div class="td-lc-empty">
      <span class="td-lc-hint">No room yet</span>
      <Button variant="solid" onclick={() => App.go('control')}>Choose this frame’s room</Button>
    </div>
  {/if}
</div>

<style>
  .td-lc {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    background: var(--card);
    border-radius: var(--r);
    padding: 8px 12px;
  }
  .td-lc-head {
    flex: none;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 6px;
    text-align: left;
    transition: transform 0.15s var(--ease);
  }
  .td-lc-head:global(.is-pressed) { transform: scale(0.98); transition-duration: 0s; }
  .td-lc-name {
    flex: 1;
    min-width: 0;
    font-size: var(--fs-m);
    font-weight: 800;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .td-lc-tiles { flex: none; display: flex; gap: 8px; overflow-x: auto; }
  .td-lc-tiles > :global(*) { flex: none; }
  .td-lc-empty { flex: 1; display: flex; flex-direction: column; justify-content: center; align-items: flex-start; gap: 10px; padding: 0 6px; }
  .td-lc-hint { font-size: var(--fs-label); font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: var(--mute); }
</style>

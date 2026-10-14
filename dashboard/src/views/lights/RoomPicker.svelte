<script lang="ts">
  // Rooms and zones as big rows. 'pick' chooses the frame's room, 'browse' opens a room's controls.
  import { Icon, pressable } from '../../lib/ui';
  import { lights } from '../../lib/state/lights.svelte';

  let {
    mode,
    current = null,
    onpick,
  }: {
    mode: 'pick' | 'browse';
    /** Room shown or chosen now, marked in the list. */
    current?: string | null;
    onpick: (id: string) => void;
  } = $props();

  const rooms = $derived(lights.rooms.filter((r) => r.kind === 'room'));
  const zones = $derived(lights.rooms.filter((r) => r.kind === 'zone'));

  function summary(id: string): string {
    const room = lights.rooms.find((r) => r.id === id);
    const n = room ? lights.lightsOf(room).filter((l) => l.on).length : 0;
    return n ? n + ' on' : 'All off';
  }
</script>

{#snippet group(title: string, list: typeof rooms)}
  {#if list.length}
    <h3 class="label rp-title">{title}</h3>
    {#each list as r (r.id)}
      <button class="rp-row" class:here={r.id === current} onclick={() => onpick(r.id)} {@attach pressable}>
        <Icon name={r.kind === 'zone' ? 'home' : 'bulb'} size={28} />
        <span class="rp-name">{r.name}</span>
        <span class="rp-state" class:lit={r.on}>{summary(r.id)}</span>
      </button>
    {/each}
  {/if}
{/snippet}

<div class="rp" data-mode={mode}>
  {@render group('Rooms', rooms)}
  {@render group('Zones', zones)}
</div>

<style>
  .rp { display: flex; flex-direction: column; gap: 8px; }
  .rp-title { margin: 12px 0 2px; }
  .rp-row {
    min-height: 72px;
    padding: 0 20px;
    display: flex;
    align-items: center;
    gap: 16px;
    border-radius: var(--r);
    background: var(--card);
    border: 2px solid var(--line);
    text-align: left;
    transition: transform 0.15s var(--ease);
  }
  .here { border-color: var(--ink); }
  .rp-row:global(.is-pressed) { transform: scale(0.98); transition-duration: 0s; }
  .rp-name { flex: 1; font-size: var(--fs-m); font-weight: 800; }
  .rp-state { font-size: var(--fs-body); font-weight: 700; color: var(--mute); }
  .rp-state.lit { color: var(--ink); }
</style>

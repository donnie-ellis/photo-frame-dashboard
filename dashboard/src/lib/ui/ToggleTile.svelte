<script lang="ts">
  // A compact on/off tile: icon and name, tinted when on. Tap only. Use SliderTile when it needs dimming.
  import Icon from './Icon.svelte';
  import { pressable } from './pressable';

  let {
    name,
    icon = 'bulb',
    on,
    pending = false,
    color,
    ontoggle,
  }: {
    name: string;
    icon?: string;
    on: boolean;
    pending?: boolean;
    /** A small dot showing the light's colour (a CSS colour). */
    color?: string;
    ontoggle: () => void;
  } = $props();
</script>

<button
  class="tgl"
  class:tgl--on={on}
  class:tgl--pending={pending}
  aria-pressed={on}
  onclick={ontoggle}
  {@attach pressable}>
  <Icon name={icon} size={28} />
  {#if color}<span class="tgl-dot" style:background={color}></span>{/if}
  <span class="tgl-name">{name}</span>
</button>

<style>
  .tgl {
    min-width: 120px;
    max-width: 200px;
    min-height: var(--tap);
    padding: 0 18px;
    display: inline-flex;
    align-items: center;
    gap: 10px;
    background: var(--card);
    color: var(--mute);
    border: 2px solid var(--line);
    border-radius: var(--r);
    transition: transform 0.15s var(--ease);
  }
  .tgl--on { background: var(--tile-on); color: var(--ink); border-color: var(--ink); }
  .tgl--pending { opacity: 0.6; }
  .tgl:global(.is-pressed) { transform: scale(0.97); transition-duration: 0s; }
  .tgl-dot {
    flex: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 2px solid var(--ink);
  }
  .tgl-name {
    font-size: var(--fs-body);
    font-weight: 800;
    line-height: 1.1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>

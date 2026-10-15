<script lang="ts">
  // Colour and white temperature for one light. Each control shows only when the light supports it.
  import { onMount } from 'svelte';
  import { RangeSlider, SwatchRow } from '../../lib/ui';
  import { lights } from '../../lib/state/lights.svelte';

  let { id }: { id: string } = $props();

  const light = $derived(lights.devices.find((l) => l.id === id));
  const pending = $derived(lights.pending.has(id));

  const WHITES = [
    { id: '2200', label: 'Candle', k: 2200 },
    { id: '2700', label: 'Warm', k: 2700 },
    { id: '3000', label: 'Soft', k: 3000 },
    { id: '4000', label: 'Neutral', k: 4000 },
    { id: '5000', label: 'Daylight', k: 5000 },
    { id: '6500', label: 'Cool', k: 6500 },
  ];
  const NAMES = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink'];

  // The swatch tokens, read once: the hex is what gets sent to the bulb.
  let palette = $state<{ id: string; label: string; color: string }[]>([]);
  onMount(() => {
    const cs = getComputedStyle(document.documentElement);
    palette = NAMES.map((n) => ({
      id: n,
      label: n.charAt(0).toUpperCase() + n.slice(1),
      color: cs.getPropertyValue('--swatch-' + n).trim().toLowerCase(),
    })).filter((s) => /^#[0-9a-f]{6}$/.test(s.color));
  });

  const range = $derived(light?.tempRange);
  const whites = $derived(
    range
      ? WHITES.filter((w) => w.k >= range.min && w.k <= range.max).map((w) => ({
          id: w.id,
          label: w.label,
          sub: w.k + 'K',
          color: 'var(--white-' + w.k + ')',
        }))
      : [],
  );
  const sliderValue = $derived(light?.temp ?? (range ? Math.round((range.min + range.max) / 2) : 0));
  const pickedColor = $derived(
    light && light.temp === undefined ? (palette.find((s) => s.color === light.color)?.id ?? null) : null,
  );

  function pickColor(name: string) {
    const c = palette.find((s) => s.id === name)?.color;
    if (c) void lights.setLight(id, { color: c });
  }
</script>

{#if light}
  <div class="ls">
    <h2 class="serif ls-title">{light.name}</h2>
    {#if range}
      <h3 class="label ls-h">White</h3>
      {#if whites.length}
        <SwatchRow
          labels
          columns={3}
          swatches={whites}
          selected={light.temp === undefined ? null : String(light.temp)}
          {pending}
          onpick={(k) => lights.setLight(id, { temp: Number(k) })} />
      {/if}
      <div class="ls-slider">
        <RangeSlider
          label="White temperature"
          value={sliderValue}
          min={range.min}
          max={range.max}
          step={50}
          startLabel="Warm · {range.min}K"
          endLabel="Cool · {range.max}K"
          {pending}
          onchange={(k) => lights.setLight(id, { temp: k })} />
      </div>
    {/if}
    {#if light.color}
      <h3 class="label ls-h">Colour</h3>
      <SwatchRow swatches={palette} selected={pickedColor} {pending} onpick={pickColor} />
    {/if}
  </div>
{/if}

<style>
  .ls { padding: 34px 36px 32px; }
  .ls-title { font-size: 52px; line-height: 1; margin: 6px 0 18px; padding-right: var(--tap); }
  .ls-h { margin: 18px 0 10px; }
  .ls-slider { margin-top: 14px; }
</style>

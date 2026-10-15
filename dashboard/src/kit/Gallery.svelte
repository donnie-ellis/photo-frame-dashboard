<script lang="ts">
  // Every kit component in its states, at the frame's 1280×800. Add new components here.
  import { Button, Chip, HoldButton, IconButton, RangeSlider, Segmented, Sheet, SliderTile, StaleBadge, SwatchRow, ToggleTile, toast } from '../lib/ui';

  let store = $state<'all' | 'grocer' | 'costco'>('all');
  let mode = $state<'heat' | 'cool' | 'off'>('heat');
  let picked = $state<string[]>(['Produce']);
  let sheetOpen = $state(false);
  let wideOpen = $state(false);
  let unlocked = $state(0);
  let tiles = $state([
    { name: 'Island', on: false, level: 100 },
    { name: 'Pendants', on: true, level: 40 },
  ]);
  let room = $state({ on: true, level: 80 });
  let toggles = $state([{ name: 'Island', on: false }, { name: 'Pendants', on: true }]);

  let kelvin = $state(2700);
  let swatch = $state<string | null>('amber');
  let white = $state<string | null>('2700');
  const swatches = ['red', 'orange', 'amber', 'green', 'teal', 'blue', 'purple', 'pink'].map((n) => ({
    id: n,
    label: n.charAt(0).toUpperCase() + n.slice(1),
    color: 'var(--swatch-' + n + ')',
  }));
  const whites = [['2200', 'Candle'], ['2700', 'Warm'], ['3000', 'Soft'], ['4000', 'Neutral'], ['5000', 'Daylight'], ['6500', 'Cool']].map(
    ([k, label]) => ({ id: k, label, sub: k + 'K', color: 'var(--white-' + k + ')' }),
  );

  const cats = ['Produce', 'Bakery', 'Dairy & Eggs', 'Pantry', 'Frozen'];
  function togglePick(c: string) {
    picked = picked.includes(c) ? picked.filter((x) => x !== c) : [...picked, c];
  }
</script>

<div class="gallery">
  <h1 class="serif">Touch kit</h1>

  <section>
    <h2 class="label">Button</h2>
    <div class="row">
      <Button variant="solid" onclick={() => toast('Solid button')}>Save</Button>
      <Button onclick={() => toast('Ghost button')}>Cancel</Button>
      <Button variant="solid" icon="plus">Add item</Button>
      <Button disabled>Disabled</Button>
    </div>
  </section>

  <section>
    <h2 class="label">IconButton</h2>
    <div class="row">
      <IconButton icon="plus" label="Add" />
      <IconButton icon="x" label="Close" variant="soft" />
      <IconButton icon="check" label="Done" variant="solid" />
      <IconButton icon="plus" label="Add event" variant="solid" size="l" />
    </div>
  </section>

  <section>
    <h2 class="label">Segmented · {store}</h2>
    <div class="row">
      <Segmented
        bind:value={store}
        options={[
          { value: 'all', label: 'All', count: 21 },
          { value: 'grocer', label: 'FreshCo', count: 14 },
          { value: 'costco', label: 'Costco', count: 7 },
        ]} />
      <div class="dark">
        <Segmented
          tone="dark"
          bind:value={mode}
          options={[
            { value: 'heat', label: 'Heat' },
            { value: 'cool', label: 'Cool' },
            { value: 'off', label: 'Off' },
          ]} />
      </div>
    </div>
  </section>

  <section>
    <h2 class="label">Chip · {picked.join(', ') || 'none'}</h2>
    <div class="row">
      {#each cats as c (c)}
        <Chip selected={picked.includes(c)} onclick={() => togglePick(c)}>{c}</Chip>
      {/each}
      <Chip ghost>Ghost</Chip>
    </div>
  </section>

  <section>
    <h2 class="label">Sheet · Toast</h2>
    <div class="row">
      <Button onclick={() => (sheetOpen = true)}>Open sheet</Button>
      <Button onclick={() => (wideOpen = true)}>Open wide sheet</Button>
      <Button onclick={() => toast('Added Bananas to Produce', { icon: 'check', undo: () => toast('Undone') })}>Toast + undo</Button>
      <Button onclick={() => toast('Couldn’t reach Pendants · it may be offline', { tone: 'error', icon: 'bolt' })}>Error toast</Button>
    </div>
  </section>

  <section>
    <h2 class="label">HoldButton · unlocked {unlocked}×</h2>
    <div class="row">
      <HoldButton
        icon="unlock"
        onhold={() => { unlocked++; toast('Front Door unlocked', { icon: 'unlock' }); }}
        oncancel={() => toast('Keep holding to unlock', { icon: 'lock', ms: 2000 })}>Hold to unlock</HoldButton>
      <div class="dark">
        <HoldButton variant="light" icon="drop" ms={1200} onhold={() => toast('Water main shut off', { icon: 'drop' })}>Hold to shut off water</HoldButton>
      </div>
    </div>
  </section>

  <section>
    <h2 class="label">SliderTile · tap toggles, drag dims</h2>
    <div class="tiles">
      {#each tiles as t (t.name)}
        <SliderTile
          name={t.name}
          on={t.on}
          level={t.level}
          ontoggle={() => (t.on = !t.on)}
          onlevel={(l) => { t.on = l > 0; if (l > 0) t.level = l; }} />
      {/each}
      <SliderTile name="Pending" on={true} level={60} pending ontoggle={() => {}} onlevel={() => {}} />
      <SliderTile
        name="Lamp"
        on={true}
        level={70}
        color="var(--swatch-orange)"
        onmore={() => toast('More tapped')}
        moreLabel="Lamp colour and white"
        ontoggle={() => {}}
        onlevel={() => {}} />
    </div>
    <div class="tiles wide-tile">
      <SliderTile
        size="l"
        name="Kitchen"
        on={room.on}
        level={room.level}
        ontoggle={() => (room.on = !room.on)}
        onlevel={(l) => { room.on = l > 0; if (l > 0) room.level = l; }} />
    </div>
  </section>

  <section>
    <h2 class="label">ToggleTile · tap toggles</h2>
    <div class="row">
      {#each toggles as t (t.name)}
        <ToggleTile name={t.name} on={t.on} ontoggle={() => (t.on = !t.on)} />
      {/each}
      <ToggleTile name="Pending" on={true} pending ontoggle={() => {}} />
      <ToggleTile name="Lamp" on={true} color="var(--swatch-purple)" ontoggle={() => {}} />
    </div>
  </section>

  <section>
    <h2 class="label">RangeSlider · {kelvin}K</h2>
    <div class="narrow">
      <RangeSlider
        label="White temperature"
        value={kelvin}
        min={2000}
        max={6500}
        step={50}
        startLabel="Warm"
        endLabel="Cool"
        onchange={(v) => (kelvin = v)} />
    </div>
  </section>

  <section>
    <h2 class="label">SwatchRow · colours ({swatch}) and labelled presets ({white})</h2>
    <div class="narrow">
      <SwatchRow {swatches} selected={swatch} onpick={(id) => (swatch = id)} />
    </div>
    <div class="narrow gap">
      <SwatchRow labels columns={3} swatches={whites} selected={white} onpick={(id) => (white = id)} />
    </div>
  </section>

  <section>
    <h2 class="label">StaleBadge</h2>
    <div class="row">
      <StaleBadge status="stale" />
      <StaleBadge status="mock" />
    </div>
  </section>
</div>

<Sheet bind:open={sheetOpen}>
  <div class="pad">
    <h2 class="serif sheet-title">Pendants</h2>
    <p>Kitchen · on at 80%</p>
    <div class="row actions">
      <Button onclick={() => (sheetOpen = false)}>Cancel</Button>
      <Button variant="solid" onclick={() => { sheetOpen = false; toast('Saved'); }}>Save</Button>
    </div>
  </div>
</Sheet>

<Sheet bind:open={wideOpen} wide>
  <div class="pad"><h2 class="serif sheet-title">Wide sheet</h2><p>900px, for grids of tiles.</p></div>
</Sheet>

<style>
  .gallery {
    height: 800px;
    overflow-y: auto;
    padding: var(--pad) 40px 120px;
  }
  h1 { font-size: var(--fs-xl); margin-bottom: 8px; }
  section { margin-top: 28px; }
  .row { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; margin-top: 12px; }
  .dark { background: var(--ink); padding: 12px; border-radius: var(--r); }
  .tiles { display: grid; grid-template-columns: repeat(4, 220px); gap: 10px; margin-top: 12px; }
  .narrow { width: 548px; margin-top: 12px; }
  .gap { margin-top: 16px; }
  .wide-tile { grid-template-columns: 450px; }
  .pad { padding: 34px 36px 32px; }
  .sheet-title { font-size: 52px; line-height: 1; margin: 6px 0 22px; }
  p { color: var(--ink-2); }
  .actions { justify-content: flex-end; margin-top: 26px; }
</style>

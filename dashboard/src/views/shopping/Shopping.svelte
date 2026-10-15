<script lang="ts">
  // The shared grocery list. Tap to check off (1.2 s grace, undo), filter by store, done drawer.
  // Add, quantity, usuals and clear have no contract endpoint, so they are not here.
  import { onDestroy } from 'svelte';
  import type { ViewProps } from '../../lib/legacy.svelte';
  import { Icon, Segmented, StaleBadge, pressable, toast } from '../../lib/ui';
  import { shopping } from '../../lib/state/shopping.svelte';

  let { active }: ViewProps = $props();

  const GRACE_MS = 1200;

  let store = $state('all');
  let drawer = $state(false);
  // Items ticked but not yet sent. Replaced whole, never mutated.
  let checking = $state.raw<ReadonlySet<string>>(new Set());
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  // A store that vanished from a live response falls back to All.
  const filter = $derived(store === 'all' || shopping.stores.some((s) => s.id === store) ? store : 'all');
  const inStore = $derived(shopping.items.filter((i) => filter === 'all' || i.store === filter));
  const open = $derived(inStore.filter((i) => !i.done));
  const done = $derived(inStore.filter((i) => i.done));
  const openAll = $derived(shopping.items.filter((i) => !i.done));
  const options = $derived([
    { value: 'all', label: 'All', count: openAll.length },
    ...shopping.stores.map((s) => ({
      value: s.id,
      label: s.name,
      count: openAll.filter((i) => i.store === s.id).length,
    })),
  ]);
  const firstStore = $derived(shopping.stores[0]?.id);
  const storeName = (id: string) => shopping.stores.find((s) => s.id === id)?.name ?? id;

  const groups = $derived.by(() => {
    const order = window.DATA.catOrder[filter] ?? window.DATA.catOrder.all ?? [];
    const cats = [...order];
    for (const i of open) if (!cats.includes(i.cat)) cats.push(i.cat);
    return cats
      .map((cat) => ({ cat, items: open.filter((i) => i.cat === cat) }))
      .filter((g) => g.items.length);
  });

  function setChecking(id: string, on: boolean) {
    const next = new Set(checking);
    if (on) next.add(id);
    else next.delete(id);
    checking = next;
  }

  function commit(id: string) {
    clearTimeout(timers.get(id));
    timers.delete(id);
    setChecking(id, false);
    void shopping.setDone(id, true);
  }

  function tap(id: string, name: string) {
    if (timers.has(id)) {
      clearTimeout(timers.get(id));
      timers.delete(id);
      setChecking(id, false);
      return;
    }
    setChecking(id, true);
    timers.set(id, setTimeout(() => commit(id), GRACE_MS));
    toast(`${name} checked off`, {
      icon: 'check',
      undo: () => {
        if (timers.has(id)) {
          clearTimeout(timers.get(id));
          timers.delete(id);
          setChecking(id, false);
        } else void shopping.setDone(id, false);
      },
    });
  }

  function addBack(id: string, name: string) {
    void shopping.setDone(id, false);
    toast(`Added back ${name}`, { icon: 'cart' });
  }

  function flush() {
    for (const id of [...timers.keys()]) commit(id);
  }

  // No timers while hidden: send pending check-offs now.
  $effect(() => {
    if (!active) flush();
  });
  onDestroy(flush);
</script>

<div class="sh">
  <header class="sh-head">
    <div class="sh-title">
      <div class="label">Shared list</div>
      <h1 class="serif">Groceries</h1>
    </div>
    <div class="sh-count"><span class="num">{open.length}</span> to get</div>
    <StaleBadge status={shopping.status} />
    <Segmented {options} value={filter} onchange={(v) => (store = v)} />
  </header>

  <div class="sh-list">
    {#each groups as g (g.cat)}
      <section class="sh-cat">
        <div class="sh-cat-h"><span class="label">{g.cat}</span><span class="label">{g.items.length}</span></div>
        {#each g.items as item (item.id)}
          <button
            class="sh-row"
            class:is-checking={checking.has(item.id)}
            class:is-pending={shopping.pending.has(item.id)}
            onclick={() => tap(item.id, item.name)}
            {@attach pressable}>
            <span class="sh-box"><Icon name="check" size={22} /></span>
            <span class="sh-name">
              <b>{item.name}</b>
              {#if item.note}<small>{item.note}</small>{/if}
            </span>
            {#if filter === 'all' && item.store !== firstStore}<span class="sh-store">{storeName(item.store)}</span>{/if}
            {#if item.qty > 1}<span class="sh-qty num">×{item.qty}</span>{/if}
          </button>
        {/each}
      </section>
    {:else}
      <div class="sh-empty serif">All stocked up. <i>Nothing left to buy.</i></div>
    {/each}

    {#if done.length}
      <div class="sh-drawer">
        <button class="sh-drawer-h" onclick={() => (drawer = !drawer)} {@attach pressable}>
          <span class="sh-drawer-t"><Icon name="check" size={22} /> Got it <b class="num">({done.length})</b></span>
          <span class="label">{drawer ? 'Hide' : 'Show'}</span>
        </button>
        {#if drawer}
          <div class="sh-drawer-list">
            {#each done as item (item.id)}
              <button
                class="sh-got"
                class:is-pending={shopping.pending.has(item.id)}
                onclick={() => addBack(item.id, item.name)}
                {@attach pressable}>
                {item.name}<span class="label">Add back</span>
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .sh { height: 100%; min-height: 0; display: flex; flex-direction: column; gap: var(--gap); }
  .sh-head { flex: none; display: flex; align-items: center; gap: var(--pad); }
  .sh-title h1 { font-size: var(--fs-hero); line-height: 0.95; }
  .sh-count { margin-right: auto; font-size: var(--fs-m); color: var(--mute); padding-top: var(--pad); }
  .sh-count .num { font-size: var(--fs-l); color: var(--ink); }

  .sh-list { flex: 1; min-height: 0; overflow-y: auto; padding-bottom: var(--pad); }
  .sh-cat { margin-bottom: var(--gap); }
  .sh-cat-h {
    display: flex;
    justify-content: space-between;
    padding: 6px 4px 8px;
    border-bottom: 2px solid var(--ink);
    margin-bottom: 4px;
  }
  .sh-row {
    width: 100%;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    gap: var(--gap);
    padding: 8px 10px 8px 4px;
    border-bottom: 1px solid var(--line);
    text-align: left;
    transition: transform 0.15s var(--ease);
  }
  .sh-row:global(.is-pressed), .sh-got:global(.is-pressed), .sh-drawer-h:global(.is-pressed) {
    transform: scale(0.98);
    transition-duration: 0s;
  }
  .sh-row.is-pending, .sh-got.is-pending { opacity: 0.6; }
  .sh-box {
    width: 40px;
    height: 40px;
    border-radius: var(--r-s);
    flex: none;
    display: grid;
    place-items: center;
    color: transparent;
    box-shadow: inset 0 0 0 3px var(--line);
  }
  .sh-name { flex: 1; min-width: 0; display: flex; flex-direction: column; }
  .sh-name b {
    font-size: var(--fs-m);
    font-weight: 700;
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sh-name small { font-size: var(--fs-body); color: var(--mute); }
  .sh-store {
    font-size: var(--fs-min);
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 5px 9px;
    border-radius: 6px;
    background: var(--ink);
    color: var(--paper);
  }
  .sh-qty { font-size: var(--fs-l); color: var(--mute); }
  .sh-row.is-checking .sh-box { background: var(--ink); color: var(--paper); box-shadow: none; }
  .sh-row.is-checking .sh-name b { color: var(--mute); text-decoration: line-through; text-decoration-thickness: 3px; }
  .sh-empty { font-size: var(--fs-xl); line-height: 1.05; color: var(--mute); padding: 80px 0; text-align: center; }

  .sh-drawer { margin-top: var(--gap); border-radius: var(--r); background: var(--paper-2); overflow: hidden; }
  .sh-drawer-h {
    width: 100%;
    min-height: var(--tap);
    padding: 0 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--fs-body);
    font-weight: 700;
  }
  .sh-drawer-t { display: flex; align-items: center; gap: 10px; }
  .sh-drawer-t .num { font-size: var(--fs-m); }
  .sh-drawer-list { padding: 0 12px var(--gap); display: flex; flex-direction: column; gap: 8px; }
  .sh-got {
    min-height: var(--tap);
    padding: 0 12px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: var(--fs-body);
    color: var(--mute);
    text-decoration: line-through;
    border-radius: var(--r-s);
  }
  .sh-got .label { text-decoration: none; }
</style>

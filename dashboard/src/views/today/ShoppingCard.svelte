<script lang="ts">
  // What is left to buy. Tap an item to check it off (with undo), the header opens Shopping.
  import { Icon, StaleBadge, pressable, toast } from '../../lib/ui';
  import { shopping } from '../../lib/state/shopping.svelte';

  const App = window.App;
  const open = $derived(shopping.items.filter((i) => !i.done));

  function got(id: string, name: string) {
    void shopping.setDone(id, true);
    toast(`Got ${name}`, { icon: 'check', undo: () => void shopping.setDone(id, false) });
  }
</script>

<div class="td-shop">
  <button class="td-shop-head" onclick={() => App.go('shopping')} {@attach pressable}>
    <span class="td-shop-title">Shopping</span>
    <span class="td-shop-count num">{open.length}</span>
    <StaleBadge status={shopping.status} />
  </button>
  <ul class="td-shop-list">
    {#each open as item (item.id)}
      <li>
        <button
          class="td-item"
          class:is-pending={shopping.pending.has(item.id)}
          onclick={() => got(item.id, item.name)}
          {@attach pressable}>
          <Icon name="check" size={22} />
          <span class="td-item-n">{item.name}</span>
        </button>
      </li>
    {:else}
      <li class="td-none serif"><i>All done.</i> Nothing to buy.</li>
    {/each}
  </ul>
</div>

<style>
  .td-shop {
    height: 100%;
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: var(--r);
    padding: 6px 12px 8px;
  }
  .td-shop-head {
    flex: none;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 8px;
    text-align: left;
    transition: transform 0.15s var(--ease);
  }
  .td-shop-head:global(.is-pressed), .td-item:global(.is-pressed) { transform: scale(0.98); transition-duration: 0s; }
  .td-shop-title {
    flex: 1;
    font-size: var(--fs-label);
    font-weight: 700;
    font-stretch: 80%;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--mute);
  }
  .td-shop-count { font-size: var(--fs-l); line-height: 1; }
  .td-shop-list { flex: 1; min-height: 0; overflow-y: auto; list-style: none; margin: 0; padding: 0; }
  .td-item {
    width: 100%;
    min-height: var(--tap);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 8px;
    text-align: left;
    border-top: 1px solid var(--line);
    transition: transform 0.15s var(--ease);
  }
  .td-item.is-pending { opacity: 0.6; }
  .td-item-n { font-size: var(--fs-body); font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .td-none { font-size: var(--fs-m); color: var(--mute); padding: 12px 8px; }
</style>

<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import IconButton from './IconButton.svelte';
  import { portal } from './portal';

  let {
    open = $bindable(false),
    wide = false,
    onclose,
    children,
  }: {
    open?: boolean;
    /** 900px instead of 620px. */
    wide?: boolean;
    onclose?: () => void;
    children: Snippet;
  } = $props();

  function close() {
    open = false;
    onclose?.();
  }
</script>

{#if open}
  <!-- Flat card over a scrim: no large shadow (paint cost on the frame). -->
  <div class="layer" {@attach portal}>
    <button class="scrim" aria-label="Close" onclick={close} transition:fade={{ duration: 150 }}></button>
    <div
      class="panel"
      class:wide
      role="dialog"
      aria-modal="true"
      transition:fly={{ y: 24, duration: 200, easing: cubicOut }}>
      <div class="x"><IconButton icon="x" label="Close" variant="soft" onclick={close} /></div>
      {@render children()}
    </div>
  </div>
{/if}

<style>
  .layer {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 50;
    display: grid;
    place-items: center;
  }
  .scrim {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    background: var(--scrim);
  }
  .panel {
    position: relative;
    width: 620px;
    max-height: 720px;
    overflow: auto;
    background: var(--paper);
    border-radius: 28px;
  }
  .wide { width: 900px; }
  .x { position: absolute; right: 14px; top: 14px; z-index: 2; }
</style>

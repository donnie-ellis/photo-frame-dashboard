<script lang="ts">
  // Mount once into #stage. src/main.ts does it when the first converted view uses toast().
  import { fly } from 'svelte/transition';
  import { cubicOut } from 'svelte/easing';
  import Icon from './Icon.svelte';
  import { pressable } from './pressable';
  import { dismissToast, toasts } from './toast.svelte';

  function undo() {
    toasts.current?.undo?.();
    dismissToast();
  }
</script>

<div class="notices" aria-live="polite">
  {#if toasts.current}
    {#key toasts.current.id}
      <div
        class="notice"
        class:error={toasts.current.tone === 'error'}
        transition:fly={{ y: 120, duration: 220, easing: cubicOut }}>
        {#if toasts.current.icon}<Icon name={toasts.current.icon} size={26} />{/if}
        <span class="msg">{toasts.current.message}</span>
        {#if toasts.current.undo}
          <button class="undo" onclick={undo} {@attach pressable}><Icon name="undo" size={22} />Undo</button>
        {/if}
      </div>
    {/key}
  {/if}
</div>

<style>
  .notices {
    position: absolute;
    left: 76px;
    right: 0;
    bottom: 24px;
    display: flex;
    justify-content: center;
    pointer-events: none;
    z-index: 60;
  }
  .notice {
    pointer-events: auto;
    min-height: 72px;
    max-width: 760px;
    padding: 0 10px 0 24px;
    display: flex;
    align-items: center;
    gap: 14px;
    background: var(--ink);
    color: #fff;
    border-radius: 20px;
    font-size: var(--fs-body);
  }
  .error { background: var(--alert); }
  .msg { padding: 18px 18px 18px 0; }
  .undo {
    min-height: 56px;
    padding: 0 22px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border-radius: 14px;
    background: rgba(255, 255, 255, 0.14);
    font-size: 17px;
    font-weight: 800;
    font-stretch: 75%;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .undo:global(.is-pressed) { background: rgba(255, 255, 255, 0.28); }
</style>

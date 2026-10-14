<script lang="ts">
  // Low-key freshness label for a feed. Renders nothing while the feed is live. Not tappable.
  import Icon from './Icon.svelte';

  let { status }: { status: 'live' | 'stale' | 'mock' } = $props();
</script>

{#if status !== 'live'}
  <span class="badge">
    <Icon name="bolt" size={18} />
    {status === 'stale' ? 'Offline · showing saved' : 'Demo data'}
  </span>
{/if}

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 36px;
    padding: 0 14px;
    border-radius: 999px;
    border: 2px solid var(--line);
    color: var(--mute);
    font-size: var(--fs-min);
    font-weight: 700;
    letter-spacing: 0.04em;
  }
</style>

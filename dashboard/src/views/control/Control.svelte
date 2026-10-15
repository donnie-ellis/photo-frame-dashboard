<script lang="ts">
  import type { ViewProps } from '../../lib/legacy.svelte';
  import Lights from './Lights.svelte';

  let { active }: ViewProps = $props();
</script>

<div class="ctl">
  <div class="ctl-section">
    <Lights {active} />
  </div>
</div>

<style>
  .ctl { height: 100%; display: flex; flex-direction: column; gap: var(--gap); min-height: 0; }
  .ctl-section { flex: 1; min-height: 0; }
</style>

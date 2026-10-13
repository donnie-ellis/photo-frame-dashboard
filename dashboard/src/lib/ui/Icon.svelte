<script lang="ts">
  // Same icon set as App.icon() in js/app.js. The paths are static strings from js/icons.js.
  let { name, size = 24 }: { name: string; size?: number } = $props();
</script>

<svg
  class="i"
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true">{@html window.ICONS[name] ?? ''}</svg>

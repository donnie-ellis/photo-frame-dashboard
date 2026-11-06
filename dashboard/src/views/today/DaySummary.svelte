<script lang="ts">
  // The day summary from frame-bridge: plain text, clamped to the room the compact hero frees.
  let { text }: { text: string } = $props();
</script>

<p class="td-sum">{text}</p>

<style>
  .td-sum {
    margin: 0;
    padding: 0 var(--gap);
    font-size: var(--fs-body);
    line-height: 1.3;
    color: var(--ink-2);
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    overflow: hidden;
  }
</style>

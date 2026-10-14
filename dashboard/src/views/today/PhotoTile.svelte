<script lang="ts">
  // The photo slideshow, running only while the view is active. Tap opens Photos.
  import { untrack } from 'svelte';
  import type { Attachment } from 'svelte/attachments';
  import type { PhotoMeta } from '../../lib/legacy.svelte';
  import { pressable } from '../../lib/ui';

  let { active }: { active: boolean } = $props();
  const App = window.App;

  let meta = $state.raw<PhotoMeta | null>(null);
  let show: InstanceType<typeof App.Slideshow> | undefined;

  // Built once. `active` is read untracked, so a visit doesn't rebuild the slideshow.
  const stage: Attachment<HTMLElement> = (el) => {
    show = new App.Slideshow(el, {
      layout: 'cover',
      captions: false,
      interval: 12000,
      onChange: (s) => (meta = App.photoMeta(s.photos[0])),
    });
    if (untrack(() => active)) show.start();
    return () => {
      show?.stop();
      show = undefined;
    };
  };

  $effect(() => {
    if (active) show?.start();
    else show?.stop();
  });
</script>

<button class="td-photo" onclick={() => App.go('photos')} {@attach pressable}>
  <span class="td-stage" {@attach stage}></span>
  {#if meta}
    <span class="td-cap">
      <b>{meta.onThisDay ? 'On this day · ' : ''}{meta.kicker}</b>
      <span>{meta.place}</span>
    </span>
  {/if}
</button>

<style>
  .td-photo {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: var(--r);
    overflow: hidden;
    background: var(--paper-2);
    transition: transform 0.15s var(--ease);
  }
  .td-photo:global(.is-pressed) { transform: scale(0.985); transition-duration: 0s; }
  .td-stage { position: absolute; top: 0; right: 0; bottom: 0; left: 0; }
  .td-cap {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 18px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    text-align: left;
  }
  .td-cap b { font-size: var(--fs-min); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .td-cap span { font-family: var(--serif); font-size: var(--fs-body); font-style: italic; }
</style>

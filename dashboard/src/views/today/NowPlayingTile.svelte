<script lang="ts">
  // The now-playing card that takes the photo tile's place while music plays. Tap opens Photos.
  import { nowPlaying } from '../../lib/state/nowplaying.svelte';
  import { nowPlayingArtUrl } from '../../lib/api/frame-bridge';
  import { pressable, Icon } from '../../lib/ui';

  const App = window.App;

  const np = $derived(nowPlaying.data);
  const key = $derived(nowPlaying.artKey);
  // Art that failed to load, per track.
  let failedKey = $state('');
  // Art that has finished loading, per track. It fades in so a slow JPEG never paints row by row.
  let loadedKey = $state('');
  const showArt = $derived(!!np?.art && failedKey !== key);
</script>

<button class="td-np" onclick={() => App.go('photos')} {@attach pressable}>
  <span class="td-np-ph"><Icon name="music" size={48} /></span>
  {#if showArt}
    <img
      class="td-np-art"
      class:loaded={loadedKey === key}
      src={nowPlayingArtUrl(key, 'half')}
      alt=""
      decoding="async"
      onload={() => (loadedKey = key)}
      onerror={() => (failedKey = key)}
    />
  {/if}
  <span class="td-np-cap">
    <b>{np?.room}</b>
    <span class="td-np-title">{np?.title}</span>
    {#if np?.artist}<span class="td-np-artist">{np.artist}</span>{/if}
  </span>
</button>

<style>
  .td-np {
    position: relative;
    display: block;
    width: 100%;
    height: 100%;
    border-radius: var(--r);
    overflow: hidden;
    background: var(--paper-2);
    transition: transform 0.15s var(--ease);
  }
  .td-np:global(.is-pressed) { transform: scale(0.985); transition-duration: 0s; }
  .td-np-art { position: absolute; top: 0; left: 0; width: 100%; height: 100%; object-fit: cover; opacity: 0; transition: opacity 0.3s var(--ease); }
  .td-np-art.loaded { opacity: 1; }
  .td-np-ph {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    left: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mute);
  }
  .td-np-cap {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    padding: 12px 18px;
    background: var(--photo-scrim);
    color: var(--photo-on);
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
  }
  .td-np-cap b { font-size: var(--fs-min); font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; }
  .td-np-title, .td-np-artist, .td-np-cap b {
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .td-np-title { font-family: var(--serif); font-size: var(--fs-body); font-weight: 700; }
  .td-np-artist { font-size: var(--fs-body); }
</style>

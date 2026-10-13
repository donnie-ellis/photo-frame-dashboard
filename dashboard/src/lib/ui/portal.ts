import type { Attachment } from 'svelte/attachments';

// Moves an overlay to the stage so it covers the views and the rail. Views are separate stacking
// contexts, so a sheet rendered inside one could never sit above the rail.
export const portal: Attachment<HTMLElement> = (el) => {
  (document.getElementById('stage') ?? document.body).appendChild(el);
  return () => el.remove();
};

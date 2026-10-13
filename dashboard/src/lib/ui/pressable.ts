import type { Attachment } from 'svelte/attachments';

// Pressed state from pointerdown. Mobile Chrome can hold back :active while it decides whether a
// touch is a scroll, which misses the 100 ms feedback rule, so components style `.is-pressed`
// instead. Touch pointers are captured by their target, so this clears on lift or cancel (scroll).
export const pressable: Attachment<HTMLElement> = (el) => {
  const on = () => el.classList.add('is-pressed');
  const off = () => el.classList.remove('is-pressed');
  const opts = { passive: true };
  el.addEventListener('pointerdown', on, opts);
  el.addEventListener('pointerup', off, opts);
  el.addEventListener('pointercancel', off, opts);
  el.addEventListener('pointerleave', off, opts);
  return () => {
    el.removeEventListener('pointerdown', on);
    el.removeEventListener('pointerup', off);
    el.removeEventListener('pointercancel', off);
    el.removeEventListener('pointerleave', off);
  };
};

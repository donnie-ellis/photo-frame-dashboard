// Subject-aware crops: no DOM, no runtime imports. Turns a focus box (fractions of the image, top-left
// origin) into an object-position for `cover`, and clamps the Ken Burns drift so the box stays in view.

export interface Focus {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Ken Burns zoom. Must match scale() in the Crop.svelte keyframes. */
export const KB_ZOOM = 1.08;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

// One axis: r is the visible fraction of the image under cover.
function axis(f0: number, f1: number, r: number, drift: number | undefined) {
  const s = clamp((f0 + f1) / 2 - r / 2, 0, 1 - r);
  const p = r >= 1 ? 0.5 : s / (1 - r);
  if (drift === undefined) return { p, d: 0 };
  // Focus edges in box coordinates, and the extra room the zoom gives on each side.
  const fb0 = (f0 - s) / r;
  const fb1 = (f1 - s) / r;
  const k = 0.5 - 0.5 / KB_ZOOM;
  const lo = Math.max(-k, k - fb0);
  const hi = Math.min(k, 1 - k - fb1);
  const d = lo <= hi ? clamp(drift, lo, hi) : clamp(0.5 - (fb0 + fb1) / 2, -k, k);
  return { p, d };
}

export function focusCrop(
  f: Focus,
  imgAR: number,
  boxAR: number,
  drift?: { dx: number; dy: number },
): { pos: string; dx: number; dy: number } {
  const rx = imgAR > boxAR ? boxAR / imgAR : 1;
  const ry = imgAR > boxAR ? 1 : imgAR / boxAR;
  const x = axis(f.x, f.x + f.w, rx, drift?.dx);
  const y = axis(f.y, f.y + f.h, ry, drift?.dy);
  return {
    pos: `${(x.p * 100).toFixed(2)}% ${(y.p * 100).toFixed(2)}%`,
    dx: x.d,
    dy: y.d,
  };
}

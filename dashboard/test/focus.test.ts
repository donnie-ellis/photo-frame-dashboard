import { test } from 'node:test';
import assert from 'node:assert/strict';
import { focusCrop, KB_ZOOM } from '../src/views/photos/focus.ts';

const box = (cx: number, cy: number, w = 0.1, h = 0.1) => ({ x: cx - w / 2, y: cy - h / 2, w, h });
const K = 0.5 - 0.5 / KB_ZOOM;

test('same aspect ratio centres', () => {
  assert.equal(focusCrop(box(0.2, 0.8), 1.5, 1.5).pos, '50.00% 50.00%');
});

test('wide image in a square box moves x only', () => {
  assert.equal(focusCrop(box(0.5, 0.5), 1.6, 1).pos, '50.00% 50.00%');
  assert.equal(focusCrop(box(0.4, 0.5), 1.6, 1).pos, '23.33% 50.00%');
  assert.equal(focusCrop(box(0.1, 0.5), 1.6, 1).pos, '0.00% 50.00%');
  assert.equal(focusCrop(box(0.9, 0.5), 1.6, 1).pos, '100.00% 50.00%');
});

test('tall image in a wider box moves y only', () => {
  const c = focusCrop(box(0.5, 0.1), 0.667, 0.8);
  assert.equal(c.pos, '50.00% 0.00%');
});

test('property: positions in range and a fitting focus stays in view while drifting', () => {
  const steps = [0.05, 0.25, 0.5, 0.75, 0.95];
  for (const imgAR of [0.667, 1, 1.5, 1.78]) {
    for (const boxAR of [0.8, 1, 1.6]) {
      for (const cx of steps) {
        for (const cy of steps) {
          for (const w of [0.1, 0.3, 0.6, 1]) {
            const f = { x: Math.min(Math.max(cx - w / 2, 0), 1 - w), y: Math.min(Math.max(cy - 0.1, 0), 0.8), w, h: 0.2 };
            for (const d of [-0.035, 0, 0.035]) {
              const c = focusCrop(f, imgAR, boxAR, { dx: d, dy: d / 2 });
              for (const v of c.pos.split(' ').map((s) => parseFloat(s))) assert.ok(v >= 0 && v <= 100);
              assert.ok(Math.abs(c.dx) <= K + 1e-9 && Math.abs(c.dy) <= K + 1e-9);
              const rx = imgAR > boxAR ? boxAR / imgAR : 1;
              const ry = imgAR > boxAR ? 1 : imgAR / boxAR;
              for (const [f0, f1, r, dd] of [[f.x, f.x + f.w, rx, c.dx], [f.y, f.y + f.h, ry, c.dy]] as const) {
                const p = parseFloat(c.pos.split(' ')[r === rx && f0 === f.x ? 0 : 1]) / 100;
                const s = r >= 1 ? 0 : p * (1 - r);
                const fb0 = (f0 - s) / r;
                const fb1 = (f1 - s) / r;
                if (fb1 - fb0 <= 1 - 2 * K && fb0 >= 0 && fb1 <= 1) {
                  assert.ok(fb0 + dd >= K - 1e-9 && fb1 + dd <= 1 - K + 1e-9);
                }
              }
            }
          }
        }
      }
    }
  }
});

test('focus wider than the safe window is centred and clamped', () => {
  const c = focusCrop({ x: 0, y: 0, w: 1, h: 1 }, 1.6, 1, { dx: 0.035, dy: 0.02 });
  assert.ok(Math.abs(c.dx) <= K);
  assert.ok(Math.abs(c.dx) < 1e-9 || c.dx !== 0.035);
});

test('no drift gives zero offsets', () => {
  const c = focusCrop(box(0.3, 0.3), 1.6, 1);
  assert.equal(c.dx, 0);
  assert.equal(c.dy, 0);
});

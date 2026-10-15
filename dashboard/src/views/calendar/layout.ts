// Time-grid geometry and overlap layout. Pure functions, no DOM.
import type { CalEvent } from '../../lib/state/calendar.svelte';

export const PX = 72; // px per hour
export const START = 6; // 6 AM
export const END = 23; // 11 PM
export const GRID_H = (END - START) * PX;

export function y(d: Date): number {
  return (d.getHours() + d.getMinutes() / 60 - START) * PX;
}

function dayStart(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Top and height of an event inside one day's grid, clipped to the visible hours. */
export function clampTop(e: CalEvent, day: Date): { top: number; h: number } {
  const s = dayStart(day);
  const a = e.start < s ? new Date(+s + START * 36e5) : e.start;
  const endOfDay = new Date(+s + END * 36e5);
  const b = e.end > endOfDay ? endOfDay : e.end;
  const top = Math.max(0, y(a));
  return { top, h: Math.max(24, y(b) - top - 3) };
}

export type Placed =
  | { kind: 'ev'; e: CalEvent; col: number; cols: number }
  | { kind: 'more'; more: CalEvent[]; col: number; cols: number; start: Date; end: Date };

/** Side-by-side columns for overlapping events, capped at 2. Extra events collapse into a "+N more" block. */
export function layout(evs: CalEvent[]): Placed[] {
  const out: Placed[] = [];
  const clusters: CalEvent[][] = [];
  let cur: CalEvent[] | null = null;
  let curEnd = 0;
  for (const e of evs) {
    if (!cur || +e.start >= curEnd) {
      cur = [];
      clusters.push(cur);
      curEnd = 0;
    }
    cur.push(e);
    curEnd = Math.max(curEnd, +e.end);
  }
  for (const c of clusters) {
    const cols: number[] = [];
    const placed: { e: CalEvent; col: number }[] = [];
    for (const e of c) {
      let i = cols.findIndex((end) => end <= +e.start);
      if (i < 0) {
        i = cols.length;
        cols.push(0);
      }
      cols[i] = +e.end;
      placed.push({ e, col: i });
    }
    const n = cols.length;
    if (n <= 2) {
      for (const p of placed) out.push({ kind: 'ev', e: p.e, col: p.col, cols: n });
    } else {
      const extra = placed.filter((p) => p.col > 0).map((p) => p.e);
      for (const p of placed) if (p.col === 0) out.push({ kind: 'ev', e: p.e, col: 0, cols: 2 });
      out.push({
        kind: 'more',
        more: extra,
        col: 1,
        cols: 2,
        start: new Date(Math.min(...extra.map((e) => +e.start))),
        end: new Date(Math.max(...extra.map((e) => +e.end))),
      });
    }
  }
  return out;
}

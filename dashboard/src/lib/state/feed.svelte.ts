// Shared pieces of the feed stores: live/stale/mock status, one health poll, and the write-through
// to window.DATA for the vanilla views that still read it.
import * as api from '../api/frame-bridge';
import type { FeedHealth } from '../api/frame-bridge';
import type { LegacyData } from '../legacy.svelte';

export type FeedStatus = 'live' | 'stale' | 'mock';

const HEALTH_MS = 60000;

/** live = loaded from the bridge at least once; failing = the last fetch or health check was bad. */
export class Freshness {
  #live = $state(false);
  #failing = $state(false);
  updatedAt = $state.raw<Date | null>(null);

  get status(): FeedStatus {
    if (!this.#live) return 'mock';
    return this.#failing ? 'stale' : 'live';
  }

  ok(): void {
    this.#live = true;
    this.#failing = false;
    this.updatedAt = new Date();
  }

  /** A failed fetch or write. Nothing to flag while we are still on the mock. */
  fail(): void {
    if (this.#live) this.#failing = true;
  }

  /** Clears the stale flag after a good write, without touching `updatedAt`. */
  clear(): void {
    this.#failing = false;
  }

  /** Health says error, or older than staleAfterSeconds, means failing. No feed entry means failing. */
  applyHealth(feed?: FeedHealth): void {
    if (!this.#live) return;
    if (!feed) {
      this.#failing = true;
      return;
    }
    const age = feed.updatedAt ? (Date.now() - new Date(feed.updatedAt).getTime()) / 1000 : Infinity;
    this.#failing = feed.status === 'error' || age > feed.staleAfterSeconds;
  }
}

type FeedName = keyof api.Health['feeds'];
const watchers = new Set<{ name: FeedName; fn: (feed?: FeedHealth) => void }>();
let timer: ReturnType<typeof setInterval> | undefined;

async function tick(): Promise<void> {
  let feeds: api.Health['feeds'] | undefined;
  try {
    feeds = (await api.getHealth()).feeds;
  } catch {
    // Unreachable: every subscriber gets undefined.
  }
  watchers.forEach((w) => w.fn(feeds?.[w.name]));
}

/** Check /healthz every 60 s, once for all subscribers. Returns an unsubscribe function. */
export function watchHealth(name: FeedName, fn: (feed?: FeedHealth) => void): () => void {
  const w = { name, fn };
  watchers.add(w);
  if (!timer) timer = setInterval(() => void tick(), HEALTH_MS);
  return () => {
    watchers.delete(w);
    if (watchers.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

/** Assign a feed to window.DATA (never replace DATA itself) and tell the vanilla views. */
export function writeLegacy<K extends keyof LegacyData>(prop: K, value: LegacyData[K]): void {
  window.DATA[prop] = value;
  window.App.emit('data', prop);
}

// Lights feed: rooms, zones, lights and scenes from frame-bridge, with the offline mock as the
// fallback. Items are replaced whole (never mutated) and writes are optimistic with rollback.
// window.DATA is not touched (no vanilla view reads lights).
import * as api from '../api/frame-bridge';
import type { Light, LightPatch, Room, Scene } from '../api/frame-bridge';
import * as events from '../api/events';
import { toast } from '../ui';
import { buildMock } from './lights.mock';
import { Freshness, watchHealth, type FeedStatus } from './feed.svelte';

export type { FeedStatus };

const ROOM_KEY = 'lights.defaultRoom';

function readStoredRoom(): string | null {
  try {
    return localStorage.getItem(ROOM_KEY);
  } catch {
    return null;
  }
}

function replaceById<T extends { id: string }>(list: T[], item: T): T[] {
  return list.map((x) => (x.id === item.id ? item : x));
}

interface Snapshot {
  devices: Light[];
  rooms: Room[];
}

class LightsStore {
  rooms = $state.raw<Room[]>([]);
  devices = $state.raw<Light[]>([]);
  scenes = $state.raw<Scene[]>([]);
  pending = $state.raw<ReadonlySet<string>>(new Set());
  /** Raw stored id. Use `defaultRoom`, which checks it against the rooms. */
  storedRoom = $state<string | null>(readStoredRoom());

  #fresh = new Freshness();
  #users = 0;
  #inflight = new Map<string, number>();
  #unsubs: Array<() => void> = [];

  constructor() {
    const mock = buildMock();
    this.rooms = mock.rooms;
    this.devices = mock.devices;
    this.scenes = mock.scenes;
  }

  get status(): FeedStatus {
    return this.#fresh.status;
  }

  get updatedAt(): Date | null {
    return this.#fresh.updatedAt;
  }

  /** The frame's room, if the stored id exists in the current rooms. Checked against mock rooms too,
   *  without wiping the stored value, so a real Hue id survives an offline start. */
  get defaultRoom(): Room | null {
    return this.rooms.find((r) => r.id === this.storedRoom) ?? null;
  }

  setDefaultRoom(id: string): void {
    this.storedRoom = id;
    try {
      localStorage.setItem(ROOM_KEY, id);
    } catch {
      // Storage unavailable: the choice lasts until reload.
    }
  }

  // ------------------------------------------------------------------ loading

  async load(): Promise<void> {
    try {
      const s = await api.listLights();
      this.rooms = s.rooms;
      this.devices = s.devices;
      this.scenes = s.scenes;
      this.#fresh.ok();
    } catch {
      // Keep what we have (mock on first load).
      this.#fresh.fail();
    }
  }

  /** Called when a view that shows lights is shown. Counted: Home and Lights can overlap. */
  activate(): void {
    if (this.#users++ > 0) return;
    void this.load();
    events.start();
    this.#unsubs = [
      events.on('light', (l: Light) => (this.devices = replaceById(this.devices, l))),
      events.on('room', (r: Room) => (this.rooms = replaceById(this.rooms, r))),
      events.on('scene', (s: Scene) => (this.scenes = replaceById(this.scenes, s))),
      events.on('lights', () => void this.load()),
      events.onPoll(() => void this.load()),
      watchHealth('lights', (f) => this.#fresh.applyHealth(f)),
    ];
  }

  /** Called when the view is hidden: no stream, polling or timers once no view needs them. */
  deactivate(): void {
    if (this.#users === 0 || --this.#users > 0) return;
    this.#unsubs.forEach((u) => u());
    this.#unsubs = [];
    events.stop();
  }

  // ------------------------------------------------------------------ writes

  lightsOf(room: Room): Light[] {
    const byId = new Map(this.devices.map((l) => [l.id, l]));
    return room.lights.flatMap((id) => byId.get(id) ?? []);
  }

  scenesOf(roomId: string): Scene[] {
    return this.scenes.filter((s) => s.room === roomId);
  }

  async setLight(id: string, patch: LightPatch): Promise<void> {
    const prev = this.devices.find((l) => l.id === id);
    if (!prev) return;
    const snap = this.#snapshot([id]);
    this.#setLocalLight(prev, patch);
    this.#syncRooms([id], null);
    if (this.status === 'mock') return;
    await this.#send([id], snap, prev.name, async () => {
      this.devices = replaceById(this.devices, await api.setLight(id, patch));
      this.#syncRooms([id], null);
    });
  }

  async setRoom(id: string, patch: LightPatch): Promise<void> {
    const prev = this.rooms.find((r) => r.id === id);
    if (!prev) return;
    const snap = this.#snapshot(prev.lights, [id]);
    for (const l of this.lightsOf(prev)) this.#setLocalLight(l, patch);
    this.rooms = replaceById(this.rooms, {
      ...prev,
      on: patch.on ?? true,
      level: patch.level ?? prev.level,
    });
    this.#syncRooms(prev.lights, id);
    if (this.status === 'mock') return;
    await this.#send([id, ...prev.lights], snap, prev.name, async () => {
      this.rooms = replaceById(this.rooms, await api.setRoom(id, patch));
      // Without the stream, the per-light results only arrive by re-fetching.
      if (!events.connected()) await this.load();
    });
  }

  async recall(id: string): Promise<void> {
    const prev = this.scenes.find((s) => s.id === id);
    if (!prev) return;
    const before = this.scenes;
    this.scenes = this.scenes.map((s) => (s.room === prev.room ? { ...s, active: s.id === id } : s));
    if (this.status === 'mock') return;
    this.#mark([id], 1);
    try {
      this.scenes = replaceById(this.scenes, await api.recallScene(id));
      if (!events.connected()) await this.load();
      this.#fresh.clear();
    } catch {
      this.scenes = before;
      toast(`Couldn’t start ${prev.name} · it may be offline`, { tone: 'error', icon: 'bolt' });
    } finally {
      this.#mark([id], -1);
    }
  }

  // ------------------------------------------------------------------ internals

  #snapshot(lightIds: string[], roomIds: string[] = []): Snapshot {
    const ids = new Set(lightIds);
    const devices = this.devices.filter((l) => ids.has(l.id));
    const rooms = this.rooms.filter((r) => roomIds.includes(r.id) || r.lights.some((id) => ids.has(id)));
    return { devices, rooms };
  }

  #restore(snap: Snapshot): void {
    const dev = new Map(snap.devices.map((l) => [l.id, l]));
    const rm = new Map(snap.rooms.map((r) => [r.id, r]));
    this.devices = this.devices.map((l) => dev.get(l.id) ?? l);
    this.rooms = this.rooms.map((r) => rm.get(r.id) ?? r);
  }

  #setLocalLight(l: Light, patch: LightPatch): void {
    const level = patch.level ?? l.level;
    const on = patch.on ?? (patch.level !== undefined ? true : l.on);
    this.devices = replaceById(this.devices, { ...l, on, level });
  }

  /** Recompute `on` for the rooms and zones holding these lights, except one already set. */
  #syncRooms(lightIds: string[], skipRoom: string | null): void {
    const ids = new Set(lightIds);
    const dev = new Map(this.devices.map((l) => [l.id, l]));
    this.rooms = this.rooms.map((r) => {
      if (r.id === skipRoom || !r.lights.some((id) => ids.has(id))) return r;
      const lit = r.lights.flatMap((id) => dev.get(id) ?? []).filter((l) => l.on);
      const on = lit.length > 0;
      // Offline demo only: the bridge reports the real group level.
      const level = this.status === 'mock' && on ? Math.max(...lit.map((l) => l.level)) : r.level;
      return on === r.on && level === r.level ? r : { ...r, on, level };
    });
  }

  #mark(ids: string[], delta: 1 | -1): void {
    const next = new Set(this.pending);
    for (const id of ids) {
      const n = (this.#inflight.get(id) ?? 0) + delta;
      if (n > 0) {
        this.#inflight.set(id, n);
        next.add(id);
      } else {
        this.#inflight.delete(id);
        next.delete(id);
      }
    }
    this.pending = next;
  }

  async #send(ids: string[], snap: Snapshot, name: string, run: () => Promise<void>): Promise<void> {
    this.#mark(ids, 1);
    try {
      await run();
      this.#fresh.clear();
    } catch {
      this.#restore(snap);
      toast(`Couldn’t change ${name} · it may be offline`, { tone: 'error', icon: 'bolt' });
    } finally {
      this.#mark(ids, -1);
    }
  }
}

export const lights = new LightsStore();

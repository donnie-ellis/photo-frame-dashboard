// Fetch functions for frame-bridge (docs/api/frame-bridge.openapi.yaml). Types come from the
// generated file; relative /api paths work because the bridge serves the page (Vite proxies in dev).
import type { components } from './frame-bridge.gen';

export type Light = components['schemas']['Light'];
export type Room = components['schemas']['Room'];
export type Scene = components['schemas']['Scene'];
export type LightsState = components['schemas']['LightsState'];
export type LightPatch = components['schemas']['LightPatch'];
export type RoomPatch = components['schemas']['RoomPatch'];
export type Health = components['schemas']['Health'];
export type FeedHealth = components['schemas']['FeedHealth'];
// Not `Event`: that name is the DOM's.
export type ApiEvent = components['schemas']['Event'];
export type ShoppingItem = components['schemas']['ShoppingItem'];
export type ShoppingItemPatch = components['schemas']['ShoppingItemPatch'];
export type ShoppingList = components['schemas']['ShoppingList'];
export type Store = components['schemas']['Store'];
export type Weather = components['schemas']['Weather'];
export type WeatherCondition = components['schemas']['WeatherCondition'];
export type Photo = components['schemas']['Photo'];
export type NowPlaying = components['schemas']['NowPlaying'];

const TIMEOUT_MS = 8000;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(path, { ...init, signal: ctrl.signal });
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try {
        const body = (await res.json()) as components['schemas']['Error'];
        if (body.error) msg = body.error;
      } catch {
        // Not JSON: keep the status.
      }
      throw new Error(msg);
    }
    return (await res.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

function send<T>(method: 'PUT' | 'PATCH', path: string, body: LightPatch | RoomPatch | ShoppingItemPatch): Promise<T> {
  return request<T>(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const listLights = () => request<LightsState>('/api/lights');
export const setLight = (id: string, patch: LightPatch) =>
  send<Light>('PUT', '/api/lights/' + encodeURIComponent(id), patch);
export const setRoom = (id: string, patch: RoomPatch) =>
  send<Room>('PUT', '/api/rooms/' + encodeURIComponent(id), patch);
export const recallScene = (id: string) =>
  request<Scene>('/api/scenes/' + encodeURIComponent(id) + '/recall', { method: 'POST' });
export const getHealth = () => request<Health>('/healthz');

const pad = (n: number) => (n < 10 ? '0' : '') + n;

/** Local time with its UTC offset (`2026-10-12T00:00:00-04:00`), as the spec asks. Not toISOString(). */
function isoLocal(d: Date): string {
  const off = -d.getTimezoneOffset();
  const a = Math.abs(off);
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}` +
    `${off < 0 ? '-' : '+'}${pad(Math.floor(a / 60))}:${pad(a % 60)}`
  );
}

export const listEvents = (from: Date, to: Date) =>
  request<ApiEvent[]>(
    '/api/calendar?from=' + encodeURIComponent(isoLocal(from)) + '&to=' + encodeURIComponent(isoLocal(to)),
  );
export const getShoppingList = () => request<ShoppingList>('/api/shopping');
export const setShoppingItem = (id: string, patch: ShoppingItemPatch) =>
  send<ShoppingItem>('PATCH', '/api/shopping/' + encodeURIComponent(id), patch);
export const getWeather = () => request<Weather>('/api/weather');
export const listPhotos = () => request<Photo[]>('/api/photos');
export const photoUrl = (id: string, size: 'full' | 'half' = 'full') =>
  '/api/photos/' + encodeURIComponent(id) + '/image?size=' + size;
export const getNowPlaying = () => request<NowPlaying>('/api/nowplaying');
/** `key` is the per-track cache-buster (the server ignores it). */
export const nowPlayingArtUrl = (key: string, size: 'full' | 'half' = 'half') =>
  '/api/nowplaying/art?size=' + size + '&v=' + encodeURIComponent(key);

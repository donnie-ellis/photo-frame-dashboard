// Fetch functions for frame-bridge (docs/api/frame-bridge.openapi.yaml). Types come from the
// generated file; relative /api paths work because the bridge serves the page (Vite proxies in dev).
import type { components } from './frame-bridge.gen';

export type Light = components['schemas']['Light'];
export type Room = components['schemas']['Room'];
export type Scene = components['schemas']['Scene'];
export type LightsState = components['schemas']['LightsState'];
export type LightPatch = components['schemas']['LightPatch'];
export type Health = components['schemas']['Health'];

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

function put<T>(path: string, body: LightPatch): Promise<T> {
  return request<T>(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export const listLights = () => request<LightsState>('/api/lights');
export const setLight = (id: string, patch: LightPatch) =>
  put<Light>('/api/lights/' + encodeURIComponent(id), patch);
export const setRoom = (id: string, patch: LightPatch) =>
  put<Room>('/api/rooms/' + encodeURIComponent(id), patch);
export const recallScene = (id: string) =>
  request<Scene>('/api/scenes/' + encodeURIComponent(id) + '/recall', { method: 'POST' });
export const getHealth = () => request<Health>('/healthz');

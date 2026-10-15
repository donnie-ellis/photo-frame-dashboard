// Offline / local-dev fallback in the API's shape. The js/data.js mocks differ (scenes carry `set`,
// rooms have no kind/on/level/lights), so convert them here. Never mutates window.DATA.
import type { Light, LightsState, Room, Scene } from '../api/frame-bridge';

interface MockDevice {
  id: string;
  room: string;
  type: string;
  name: string;
  on?: boolean;
  level?: number;
}

// Capabilities the js/data.js mocks don't carry, so the sheet can be tried offline.
const CAPS: Record<string, Partial<Light>> = {
  'l-lamp': { tempRange: { min: 2000, max: 6500 }, temp: 2700 },
  'l-ceil': { tempRange: { min: 2000, max: 6500 }, color: '#ffb36b', temp: 4000 },
  'u-maya': { color: '#ff8a3d' },
  'k-pend': { tempRange: { min: 2200, max: 6500 } },
};

function summarize(base: { id: string; name: string; kind: Room['kind'] }, members: Light[]): Room {
  const lit = members.filter((l) => l.on);
  const levels = (lit.length ? lit : members).map((l) => l.level);
  return {
    ...base,
    on: lit.length > 0,
    level: levels.length ? Math.max(...levels) : 100,
    lights: members.map((l) => l.id),
  };
}

export function buildMock(): LightsState {
  const data = (window as unknown as { DATA?: { rooms: { id: string; name: string }[]; devices: MockDevice[] } }).DATA;
  const devices: Light[] = (data?.devices ?? [])
    .filter((d) => d.type === 'light')
    .map((d) => ({ id: d.id, room: d.room, type: 'light', name: d.name, on: !!d.on, level: d.level ?? 100, ...CAPS[d.id] }));

  const rooms: Room[] = (data?.rooms ?? []).map((r) =>
    summarize({ id: r.id, name: r.name, kind: 'room' }, devices.filter((l) => l.room === r.id)),
  );
  const downstairs = devices.filter((l) => l.room === 'kitchen' || l.room === 'living');
  rooms.push(summarize({ id: 'downstairs', name: 'Downstairs', kind: 'zone' }, downstairs));

  const scenes: Scene[] = [
    { id: 'sc-k-dinner', room: 'kitchen', name: 'Dinner', active: false, icon: 'utensils' },
    { id: 'sc-k-bright', room: 'kitchen', name: 'Bright', active: false },
    { id: 'sc-l-movie', room: 'living', name: 'Movie', active: false, icon: 'film' },
    { id: 'sc-l-relax', room: 'living', name: 'Relax', active: false },
    { id: 'sc-u-night', room: 'upstairs', name: 'Goodnight', active: false, icon: 'moon' },
    { id: 'sc-d-morning', room: 'downstairs', name: 'Morning', active: false, icon: 'sunrise' },
  ];
  return { rooms, devices, scenes };
}

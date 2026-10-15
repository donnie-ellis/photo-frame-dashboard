import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUpdateWatcher } from '../src/lib/update-watch.ts';

const OLD = ['/assets/a-1.js', '/assets/a-1.css'];
const NEW = ['/assets/a-2.js', '/assets/a-2.css'];
const page = (list: string[]) => list.join('\n');
const parseAssets = (html: string) => (html ? html.split('\n') : []);

function setup(over: { current?: string[] } = {}) {
  const s = {
    index: { status: 200, body: page(OLD) } as { status: number; body: string } | 'throw',
    head: {} as Record<string, number>,
    gets: 0,
    reloads: 0,
    t: 1_000_000,
    touch: 0,
    busy: false,
  };
  const w = createUpdateWatcher({
    fetch: async (url, init) => {
      if (init.method === 'HEAD') return { ok: true, status: s.head[url] ?? 200, text: async () => '' };
      s.gets++;
      if (s.index === 'throw') throw new Error('offline');
      const { status, body } = s.index;
      return { ok: status >= 200 && status < 300, status, text: async () => body };
    },
    reload: () => { s.reloads++; },
    parseAssets,
    current: over.current ?? OLD,
    now: () => s.t,
    lastTouch: () => s.touch,
    isBusy: () => s.busy,
  });
  return { s, w };
}
const deploy = (s: ReturnType<typeof setup>['s']) => { s.index = { status: 200, body: page(NEW) }; };

test('same assets: no reload', async () => {
  const { s, w } = setup();
  assert.equal(await w.check(), 'same');
  assert.equal(s.reloads, 0);
});

test('new assets seen once: candidate only', async () => {
  const { s, w } = setup();
  deploy(s);
  assert.equal(await w.check(), 'candidate');
  assert.equal(s.reloads, 0);
});

test('new assets twice and HEAD 200: exactly one reload', async () => {
  const { s, w } = setup();
  deploy(s);
  await w.check();
  assert.equal(await w.check(), 'reload');
  await w.check();
  await w.check();
  assert.equal(s.reloads, 1);
});

test('HEAD 404: error and candidate reset', async () => {
  const { s, w } = setup();
  deploy(s);
  await w.check();
  s.head['/assets/a-2.css'] = 404;
  assert.equal(await w.check(), 'error');
  assert.equal(await w.check(), 'candidate');
  assert.equal(s.reloads, 0);
});

test('fetch throw and 401: error and candidate reset', async () => {
  const { s, w } = setup();
  deploy(s);
  await w.check();
  s.index = 'throw';
  assert.equal(await w.check(), 'error');
  deploy(s);
  assert.equal(await w.check(), 'candidate');
  s.index = { status: 401, body: '' };
  assert.equal(await w.check(), 'error');
  deploy(s);
  assert.equal(await w.check(), 'candidate');
  assert.equal(s.reloads, 0);
});

test('empty parsed list: skip', async () => {
  const { s, w } = setup();
  s.index = { status: 200, body: '' };
  assert.equal(await w.check(), 'skip');
  assert.equal(s.reloads, 0);
});

test('empty current: skip without fetching', async () => {
  const { s, w } = setup({ current: [] });
  deploy(s);
  assert.equal(await w.check(), 'skip');
  assert.equal(s.gets, 0);
});

test('touch within 30 s waits, then reloads after quiet', async () => {
  const { s, w } = setup();
  deploy(s);
  await w.check();
  s.touch = s.t - 5000;
  assert.equal(await w.check(), 'waiting-touch');
  assert.equal(s.reloads, 0);
  s.t += 30000;
  assert.equal(await w.check(), 'reload');
  assert.equal(s.reloads, 1);
});

test('busy waits with candidate kept, then reloads when cleared', async () => {
  const { s, w } = setup();
  deploy(s);
  await w.check();
  s.busy = true;
  assert.equal(await w.check(), 'waiting-busy');
  assert.equal(await w.check(), 'waiting-busy');
  assert.equal(s.reloads, 0);
  s.busy = false;
  assert.equal(await w.check(), 'reload');
  assert.equal(s.reloads, 1);
});

test('overlapping check() does not double-fetch', async () => {
  const { s, w } = setup();
  const [a, b] = await Promise.all([w.check(), w.check()]);
  assert.equal(a, b);
  assert.equal(s.gets, 1);
});

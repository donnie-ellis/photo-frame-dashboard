// Reloads the frame after a dashboard deploy: polls index.html, and when the hashed asset set has
// changed (seen twice, every new asset reachable), reloads once the frame is idle. The core has no
// imports and no DOM globals, so Node can import it for tests. The browser wiring is at the bottom.

interface AttrEl {
  getAttribute(name: string): string | null;
}
interface DocLike {
  querySelectorAll(selector: string): ArrayLike<AttrEl>;
}
interface ResLike {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}
type FetchLike = (url: string, init: { method?: string; cache: 'no-store'; signal: AbortSignal }) => Promise<ResLike>;

export type CheckResult = 'same' | 'candidate' | 'reload' | 'waiting-touch' | 'waiting-busy' | 'error' | 'skip';

export interface WatchDeps {
  fetch: FetchLike;
  reload: () => void;
  parseAssets: (html: string) => string[];
  current: string[];
  now: () => number;
  lastTouch: () => number;
  isBusy: () => boolean;
  touchQuietMs?: number;
  timeoutMs?: number;
}

const ASSET_RE = /^\/assets\//;

// Sorted same-origin /assets/ pathnames of the module scripts and stylesheets.
export function assetList(doc: DocLike, origin: string): string[] {
  const out: string[] = [];
  const add = (attr: string | null) => {
    if (!attr) return;
    const url = new URL(attr, origin);
    if (url.origin === new URL(origin).origin && ASSET_RE.test(url.pathname)) out.push(url.pathname);
  };
  for (const el of Array.from(doc.querySelectorAll('script[type="module"][src]'))) add(el.getAttribute('src'));
  for (const el of Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'))) add(el.getAttribute('href'));
  return out.sort();
}

const key = (list: string[]) => list.join('\n');

export function createUpdateWatcher(deps: WatchDeps) {
  const quietMs = deps.touchQuietMs ?? 30000;
  const timeoutMs = deps.timeoutMs ?? 8000;
  const currentKey = key([...deps.current].sort());
  let candidate: string | null = null;
  let running: Promise<CheckResult> | null = null;
  let reloaded = false;

  async function request(url: string, method: string): Promise<ResLike> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await deps.fetch(url, { method, cache: 'no-store', signal: ctrl.signal });
    } finally {
      clearTimeout(timer);
    }
  }

  async function run(): Promise<CheckResult> {
    if (reloaded || deps.current.length === 0) return 'skip';
    let assets: string[];
    try {
      const res = await request('/', 'GET');
      if (!res.ok) {
        candidate = null;
        return 'error';
      }
      assets = deps.parseAssets(await res.text()).sort();
    } catch {
      candidate = null;
      return 'error';
    }
    if (assets.length === 0) {
      candidate = null;
      return 'skip';
    }
    const k = key(assets);
    if (k === currentKey) {
      candidate = null;
      return 'same';
    }
    if (k !== candidate) {
      candidate = k;
      return 'candidate';
    }
    try {
      for (const path of assets) {
        const res = await request(path, 'HEAD');
        if (res.status !== 200) {
          candidate = null;
          return 'error';
        }
      }
    } catch {
      candidate = null;
      return 'error';
    }
    if (deps.now() - deps.lastTouch() < quietMs) return 'waiting-touch';
    if (deps.isBusy()) return 'waiting-busy';
    reloaded = true;
    deps.reload();
    return 'reload';
  }

  function check(): Promise<CheckResult> {
    if (running) return running;
    running = run().finally(() => {
      running = null;
    });
    return running;
  }

  return { check };
}

// Anything that means someone is using the frame. Checked at decision time only.
export const BUSY_SELECTOR = [
  '#stage:not([data-mode="day"])', // ambient, night, night dashboard
  '#view-photos.is-active', // Photos view
  '#sheetLayer.is-open', // vanilla sheets
  '#stage [role="dialog"][aria-modal="true"]', // kit Sheet
  '#demo.is-open', // demo drawer
  '#takeover.is-open', // alert takeover
  '#view-shopping.is-active .sh-drawer-list', // Shopping inline drawer
].join(', ');

const POLL_MS = 15000;

export function startUpdateWatch(): void {
  let lastTouch = 0;
  document.addEventListener('pointerdown', () => { lastTouch = Date.now(); }, { capture: true, passive: true });

  const watcher = createUpdateWatcher({
    fetch: (url, init) => fetch(url, init),
    reload: () => location.reload(),
    parseAssets: (html) => assetList(new DOMParser().parseFromString(html, 'text/html'), location.origin),
    current: assetList(document, location.origin),
    now: Date.now,
    lastTouch: () => lastTouch,
    isBusy: () => document.querySelector(BUSY_SELECTOR) !== null,
  });

  let timer: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(timer);
    if (document.hidden) return;
    timer = setTimeout(async () => {
      await watcher.check();
      arm();
    }, POLL_MS);
  };
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      clearTimeout(timer);
      return;
    }
    void watcher.check();
    arm();
  }, { passive: true });
  window.addEventListener('online', () => { void watcher.check(); }, { passive: true });
  arm();
}

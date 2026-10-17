// One shared EventSource on /api/events. If the stream fails it is closed and the registered poll
// callbacks run every 30 s instead. Stores call start() and stop(); it is reference counted.
type Handler = (data: any) => void;

const POLL_MS = 30000;
const handlers = new Map<string, Set<Handler>>();
const pollers = new Set<() => void>();
let source: EventSource | null = null;
let pollTimer: ReturnType<typeof setInterval> | undefined;
let refs = 0;

/** True while the SSE stream is open. */
export function connected(): boolean {
  return source !== null && source.readyState === EventSource.OPEN;
}

/** Subscribe to an SSE event by name (`light`, `room`, `scene`, `lights`, `calendar`, `shopping`, `chores`, `weather`, `photos`, `nowplaying`). Returns an unsubscribe function. */
export function on(name: string, fn: Handler): () => void {
  let set = handlers.get(name);
  if (!set) handlers.set(name, (set = new Set()));
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}

/** Register a callback for the 30 s fallback poll. Returns an unregister function. */
export function onPoll(fn: () => void): () => void {
  pollers.add(fn);
  return () => {
    pollers.delete(fn);
  };
}

function dispatch(name: string, e: MessageEvent) {
  let data: unknown;
  try {
    data = JSON.parse(e.data);
  } catch {
    return;
  }
  handlers.get(name)?.forEach((fn) => fn(data));
}

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => pollers.forEach((fn) => fn()), POLL_MS);
}

/** Open the stream. Reference counted: it stays open until every start() has a stop(). */
export function start(): void {
  if (refs++ > 0) return;
  if (typeof EventSource === 'undefined') {
    startPolling();
    return;
  }
  const es = new EventSource('/api/events');
  source = es;
  for (const name of ['light', 'room', 'scene', 'lights', 'calendar', 'shopping', 'chores', 'weather', 'photos', 'nowplaying']) {
    es.addEventListener(name, (e) => dispatch(name, e as MessageEvent));
  }
  es.onopen = () => {
    clearInterval(pollTimer);
    pollTimer = undefined;
  };
  es.onerror = () => {
    es.close();
    if (source === es) source = null;
    startPolling();
  };
}

export function stop(): void {
  if (refs === 0 || --refs > 0) return;
  source?.close();
  source = null;
  clearInterval(pollTimer);
  pollTimer = undefined;
}

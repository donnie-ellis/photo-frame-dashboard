---
name: wire-feed
description: Replace a mock feed (dashboard/js/data.js) (events, groceries, devices/rooms, etc.) with live data from a service API, or add a UI write (e.g. a light toggle) that goes to the API. Use when connecting the dashboard to frame-bridge or another intermediary service.
---

# Wire a feed

Goal: live data lands in the same shapes the views already use, with the mocks kept as the
fallback. New data code is TypeScript in `dashboard/src/`. Vanilla views keep reading
`window.DATA` until they are converted.

## Before you start

- The endpoint must already exist in `docs/api/<service>.openapi.yaml`. If it doesn't, use the
  `api-contract` skill first. Don't invent shapes in the dashboard.
- Read every view that consumes the feed: vanilla (`dashboard/js/views/<view>.js`) and Svelte
  (`dashboard/src/views/<view>/`).

## How live data gets in

- **Types are generated from the spec.** The first time, add `openapi-typescript` as a dev
  dependency and a script `"gen:api": "openapi-typescript ../docs/api/<service>.openapi.yaml -o src/lib/api/<service>.gen.ts"`.
  Run it after every spec change and commit the output. Never edit `*.gen.ts`.
- **Fetching:** `src/lib/api/<service>.ts`, one function per operation, using relative `/api/...`
  paths and an `AbortController` timeout (about 8 s). In dev, Vite proxies `/api` (`mock-service`
  skill). In production, frame-bridge serves the page and the API from one origin, so no proxy.
- **State:** `src/lib/state/<feed>.svelte.ts` holds the feed, plus its `status` (`live`, `stale`,
  `mock`) and `updatedAt`. Big read-only feeds (events, shopping) use `$state.raw` and are
  replaced whole on each fetch. Never mutate them in place.
- **Convert on load:** ISO strings → `Date` (`start`, `end`). The views compare `Date`s directly.
  Do this once in the state module, not in components.
- **While a vanilla view still reads the feed:** after updating state, also assign the converted
  data to `window.DATA.<prop>` (assign the property, never replace `window.DATA`: vanilla views hold
  a reference to it), then call `window.App.emit('data')`. Remove this when the last vanilla
  reader is converted.
- **Fallback:** if a fetch fails or times out, keep the current data (mock data on first load)
  and set `status: 'stale'`. Don't clear the screen.
- **Freshness:** read `GET /healthz`. When a feed is older than its `staleAfterSeconds`, show a
  small stale indicator from the kit. Keep it low-key: this is a wall display.
- **Live updates:** one shared `EventSource` on `/api/events`, in `src/lib/api/`. On error, fall back
  to polling every 30 s. Re-fetch the affected feed on each event, unless the event carries the full
  object (`light`), in which case replace that one item.

## Writes from the UI

Optimistic, in the state module, the same way for converted and vanilla views:

1. Apply the patch locally, mark the item pending, and update (state, plus `window.DATA` while
   vanilla views read it).
2. Send the request (`PUT /api/lights/{id}` etc.). The response is the source of truth: apply it.
3. On failure: restore the previous values and show an error toast (the kit's Toast, or
   `App.toast(..., { tone: 'error', icon: 'bolt' })` from vanilla code).

While `views/control.js` is still vanilla, `App.setDevice` keeps its signature (scenes, sheets and
`system.js` call it). Replace its `setTimeout` simulation with a call into the state module.

## Hide what has no source

If a feed is read-only or a device type has no real source yet, hide that UI. Don't leave it
working against mock data next to live data. Examples: the calendar "Add event" button
(`[data-add]` in `views/calendar.js`), and non-light tiles in `views/control.js`. Gate it on whether
the live feed loaded, so the full mock demo still works offline.

## Style

TypeScript with `async`/`await` in `src/`. Edits to vanilla files stay in their style (IIFE, `var`,
`App.esc()` on data in HTML).

## Done when

- [ ] `cd dashboard && npm run check && npm run build` passes.
- [ ] With the mock service or the real service running, the view shows the live data
      (`run-dashboard` skill).
- [ ] With the service stopped, the view shows mock data plus the stale indicator, and there are
      no console errors that break the app.
- [ ] Writes roll back and show a toast when the service returns an error.

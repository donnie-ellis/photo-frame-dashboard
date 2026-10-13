---
name: mock-service
description: Run a mock of an intermediary service (e.g. frame-bridge) from its OpenAPI spec so the dashboard can be developed and tested before or without the real service. Use when wiring a feed and the real service isn't running, or to test error and stale-data handling.
---

# Mock a service from its spec

Uses Prism through `npx` (no repo dependency). It serves the `example`s from
`docs/api/<service>.openapi.yaml`, and validates requests against the spec.

## Start it

Prism enforces the spec's security: requests without both `CF-Access-Client-*` headers get
401. Any value works.

Needs Node 20.19+ or 22.12+. On Node 20.5 Prism crashes with `ERR_REQUIRE_ESM`. See the
`run-dashboard` skill, step 1.

```sh
npx @stoplight/prism-cli mock docs/api/<service>.openapi.yaml -p 4010   # run in the background
curl -s -H 'CF-Access-Client-Id: dev' -H 'CF-Access-Client-Secret: dev' localhost:4010/api/lights | jq .
```

- `--dynamic` (`-d`) generates random data from the schemas instead of the examples. Use it to
  shake out rendering bugs (long names, empty arrays).
- Force a status code to test error paths: `curl -H 'Prefer: code=500' ...`. The dashboard can't set
  headers from the UI, so to test failures in the browser, stop the mock instead.

## Point the dashboard at it

The dashboard calls relative `/api/...` paths. In dev, Vite proxies them. The proxy lives in
`dashboard/vite.config.js` under `server.proxy`, and reads its target from an env var so the same
config works for the mock and the real service:

```js
// Dev only. Prism enforces the spec's Access headers (401 without them), so send dummy ones, the
// same way the Worker adds the real ones in production. The real bridge on the LAN ignores them.
var apiProxy = {
  target: process.env.API_TARGET || 'http://localhost:4010',
  headers: { 'CF-Access-Client-Id': 'dev', 'CF-Access-Client-Secret': 'dev' },
};
server: {
  host: true,
  proxy: { '/api': apiProxy, '/healthz': apiProxy },
},
```

If it isn't there yet, add it. It's a dev-only change, so it doesn't affect the WebView build
targets. Don't touch `build.target` or `cssTarget`. Then:

```sh
cd dashboard && npm run dev                                   # uses the mock on :4010
API_TARGET=http://<mac-mini>:8787 npm run dev                 # uses the real frame-bridge
```

## Limits

- **SSE:** Prism doesn't stream `/api/events`. The dashboard should fall back to polling when the
  stream fails, so the mock tests the fallback path. To test live updates, use the real service.
- **Writes don't persist.** A `PUT` returns the example, and the next `GET` returns the original
  data. That's enough to test optimistic updates and rollback, not round trips.
- Examples are static: dates in them won't be "today". Use `--dynamic` or pick examples relative to
  a fixed date and set the demo clock to match.

Stop the mock (and the dev server) when you're done.

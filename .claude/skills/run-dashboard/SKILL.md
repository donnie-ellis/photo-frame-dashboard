---
name: run-dashboard
description: Build, run, and visually check the dashboard locally, including the Android WebView 106 compatibility checks. Use to verify any change under dashboard/, or when asked to run, start, preview, or screenshot the dashboard.
---

# Run and check the dashboard

There is no test suite. Verifying a change means a clean build, the compatibility checks below,
and looking at the result.

## 1. Environment

```sh
node --version   # Vite 8, Redocly and Prism need Node 20.19+ or 22.12+
```

On this Mac, nvm's default is 20.5.1, which is too old, and `/usr/local/bin/node` is 22.21. If
`node --version` is too old, prefix commands with `PATH=/usr/local/bin:$PATH`. If that isn't
available either, stop and tell the user. Don't downgrade Vite to work around it.
Install deps if `dashboard/node_modules` is missing: `cd dashboard && npm install`.

## 2. Type check and build

```sh
cd dashboard && npm run check && npm run build
```

Both must finish with 0 errors. `svelte-check` warnings: fix them in code you touched. Before the
first `.svelte` file exists, it warns "No svelte input files were found", which is fine. Chunk size
warnings from the build are fine.

TypeScript is pinned to 6.x: `svelte-check` doesn't support TypeScript 7 yet. Don't upgrade it
until `npm view svelte-check peerDependencies` allows it.

## 3. WebView 106 checks (on the build output)

The frame runs Android WebView 106. Vite lowers syntax, but it does **not** polyfill APIs, and
the WebView rejects some CSS.

```sh
cd dashboard
# 4- or 8-digit hex colors: the WebView rejects them. Expect no output.
grep -oE '#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{4}\b' dist/assets/*.css
# APIs newer than Chrome 106. Expect no output.
grep -rnE '\.(toSorted|toReversed|toSpliced|with)\(|Object\.groupBy|Map\.groupBy|Promise\.withResolvers|Array\.fromAsync' js src dist/assets
```

Kit class names that collide with the vanilla global CSS (Svelte scoping doesn't protect against
these). Expect only `num`, which is the shared type utility, used on purpose:

```sh
comm -12 <(grep -ohE "^\s*\.[a-z][a-z0-9-]*" src/lib/ui/*.svelte | tr -d ' .' | sort -u) \
         <(grep -ohE "\.[a-z][a-z0-9_-]*" css/*.css css/views/*.css | tr -d '.' | sort -u)
```

`tsconfig.json` sets `lib: ES2022`, so `npm run check` already rejects newer JS built-ins in `src/`.
It does not limit DOM APIs. This list isn't complete. Before using any browser API you haven't seen in this codebase, check
that it shipped in Chrome 106 or earlier. CSS: avoid nesting, `color-mix()` and container style
queries.

## 4. Look at it

```sh
cd dashboard && npm run dev   # run in the background; serves on http://localhost:5173
```

Then open it in the browser (claude-in-chrome skill), with the window sized to **1280×800**,
which is the frame's viewport:

- Visit each view you touched via the left rail, and check the console for errors.
- Kit changes: open `/kit.html` (the gallery) and check each changed component, including pressed
  and disabled states.
- **If animations look stuck, check `document.visibilityState` first.** A hidden or background tab
  gets no animation frames, so Svelte transitions freeze partway and elements wait to be removed.
  That's a test-environment problem, not a bug. Ask the user to bring the browser window forward.
- The demo drawer (press and hold the rail clock) can change the time of day and the calendar mode
  (`busy`/`empty`). Use it to check edge cases.
- Take a screenshot of each changed view for the user.

To test against a service, run it or the `mock-service` skill first. Then check both cases:
service up (live data) and service down (mock fallback, stale indicator).

Stop the dev server when you're done.

## 5. On the frame (only if asked)

The kiosk app loads a URL (`DEFAULT_URL` in `dashboard/kiosk/src/.../MainActivity.java`). To test
on the device, the user has to deploy or point the kiosk at the dev server's LAN address. Ask
before doing either.

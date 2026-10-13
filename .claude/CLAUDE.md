# Project rules: photo-frame-dashboard (Donnie's fork)

These rules are specific to this repo. The root `CLAUDE.md` has the general working guidelines.
This file, the skills and the agents are committed, so Claude running in GitHub Actions follows the
same rules as Claude on the owner's Mac. Per-machine files (`settings.local.json`, `state/`) are
gitignored.

## What this repo is

A fork of wesbos/photo-frame-dashboard, now **fully diverged**. The goal is a heavily customized
family dashboard on an Android photo frame, fed by real data from small intermediary services.

- `dashboard/`: the product. A Vite web app, served on the LAN by frame-bridge on the Mac mini, plus
  `dashboard/kiosk/`, a WebView Android app that shows it full screen. No Cloudflare: see
  `docs/apple-integration.md`.
- `docs/`: integration plans and API contracts (ours), plus device/rooting notes (inherited).
- `scripts/`: inherited device tooling (backup, root, Wi-Fi). Reference only.

**Integration services are built in their own repos. This repo owns their API contracts.** The
first is `frame-bridge` (Swift on the Mac mini: Calendar, Reminders, Hue), described in
`docs/apple-integration.md`.

## Upstream

- Ignore upstream. Never open issues or PRs on `wesbos/photo-frame-dashboard`, never run the `gh`
  commands from the README's "For agents" section, and never add `upstream` as a remote.
- `origin` is `donnie-ellis/photo-frame-dashboard`. PRs go there, from a branch, against `main`.
- The README's device-safety rules still apply if we ever touch frame hardware: ask before every
  write, no writes without a verified backup, keep dumps out of git.

## API contracts (contract first)

Each service gets two files:

- `docs/api/<service>.openapi.yaml`: the contract (OpenAPI 3.1). This is the source of truth.
- `docs/<service>.md` (or the existing plan doc): why it is shaped this way, decisions, open
  questions, setup. It links to the spec. Do not restate the schemas in prose.

Rules:

1. **Change the spec first**, then the dashboard code. The service repo implements the spec. If the
   spec and the plan doc disagree, stop and ask which one is right.
2. **Shapes follow the dashboard, not the source system.** Field names come from what the views
   (`dashboard/js/views/`, `dashboard/src/views/`) actually read (`grep` for it), not from EventKit
   or Hue names.
   Example: calendar events use `loc`, `notes`, `travel`, not `location`.
3. **On the wire:** times are ISO 8601 strings with a UTC offset, and the dashboard converts them to
   `Date` on load. IDs are opaque, stable strings. Unknown optional fields are omitted, not `null`.
4. **Read-only means read-only.** If a feed is read-only (calendar), the spec has no write
   endpoints and the UI hides the write affordances. Writes are added as explicit, separate changes.
5. Every service exposes `GET /healthz` with per-feed freshness, so the dashboard can show stale data.
6. Breaking changes to a contract: say so explicitly, bump `info.version`, and list what has to
   change in the service repo.
7. **Secrets never go in this repo**: Hue keys, certs, frame tokens, calendar names that
   identify people outside the family. Use placeholders in examples.

## The device

The only target is the **BIUFRAME** (Synergy 10X1), a wall-mounted touch screen, used by the whole
family including kids. There is no mouse, keyboard, or other screen size.

- **1280×800, landscape, fixed.** The panel is natively 800×1280 portrait, and Android rotates it.
  No responsive layouts, no breakpoints, no viewport units for layout: design to the pixel grid.
- **Android 6 with WebView 106.** JS output is `chrome106`, and CSS is `chrome61` on purpose: the
  WebView rejects 4/8-digit hex colors, so use `rgba()`. Don't change the `vite.config.js` targets.
  Also none of: CSS nesting, `color-mix()`, `oklch()`, `dvh`/`svh`, `:has()` in hot paths, View
  Transitions, Popover API, or any JS API newer than Chrome 106.
- **Weak hardware:** an RK3126 (quad Cortex-A7), about 1 GB RAM, and a Mali-400 GPU. Assume painting
  happens on the CPU. Smooth interaction matters more than anything else in the UI.
- There is no device to test on yet. Keep this in mind, and say "not verified on the device" when
  a performance claim depends on it.

## UI stack

- **Svelte 5 + TypeScript**, built by Vite. Plain Svelte, not SvelteKit: it's one page, with no
  SSR or routing framework.
- **Styling:** each component's own `<style>` block (scoped), using only the CSS variables in
  `dashboard/css/tokens.css` for color, type, radius, spacing and easing. No Tailwind, no CSS-in-JS,
  no hardcoded colors or magic sizes in components. New tokens go into `tokens.css`.
- **Our own touch kit** in `dashboard/src/lib/ui/` (exports in `index.ts`). Check there before
  building UI. If a view needs a pattern twice, it goes in the kit. No component libraries (Bits UI,
  shadcn-svelte, Material, Ionic) and no new runtime dependencies without asking.
  - Tappable kit elements use the `pressable` attachment and style `:global(.is-pressed)`, not
    `:active`.
  - Overlays (sheets, toasts) attach to `#stage` (`portal`), so they cover the rail.
  - **Kit class names must not match any class in the vanilla CSS** (`css/*.css`). Svelte scoping
    doesn't stop global rules like `base.css` `.sheet` from applying. The check is in the
    `run-dashboard` skill.
  - Every kit component appears in the dev-only gallery, `dashboard/kit.html` (`npm run dev`, then
    `/kit.html`). It isn't part of the build.
  - `Toaster` is mounted in `src/main.ts` when the first converted view uses `toast()`. Until vanilla
    toasts are gone, `App.toast` and the kit `toast()` are separate.
- **API types** are generated from `docs/api/*.openapi.yaml`, not written by hand.
- **Layout of new code:** `dashboard/src/lib/ui/` (kit), `src/lib/api/` (fetch + generated types),
  `src/lib/state/` (shared reactive state), `src/views/<name>/` (one folder per view).

### Converting from vanilla, one view at a time

The vanilla code in `dashboard/js/` keeps running. A view is converted when we next work on it, not
in advance.

- A converted view registers with the existing router through `registerView(name, Component)` in
  `src/lib/legacy.svelte.ts`, called from `src/main.ts`. It mounts once, and the component gets an
  `active` prop that is false while the view is hidden: stop timers and animations then.
  `src/main.ts` is the entry point. It imports the vanilla `js/main.js` first.
- Shared data lives in `src/lib/state/`. While vanilla views still read `window.DATA`, state changes
  are written to both, and `App.emit('data')` is called for the vanilla side.
- When a view is converted, delete its `js/views/<name>.js` and `css/views/<name>.css` in the same
  change.
- **Don't touch vanilla files beyond what the bridge needs.** Don't restyle or refactor views that
  aren't being converted.

## Touch rules

- **Targets:** at least `var(--tap)` (64px) for anything tappable. Small visual elements get a
  larger hit area (padding or `::before`). Leave at least 8px between neighboring targets.
- **Feedback within 100 ms of touch-down:** use an `:active`/pressed style (scale, tint) on every
  tappable element. Never rely on hover. There are no hover styles at all.
- **Pointer events only** (`pointerdown`/`move`/`up`), not mouse or touch events. Use
  `touch-action: manipulation` globally, and `touch-action: none` only on elements that handle
  their own drag. Listeners are passive unless they call `preventDefault()`.
- **No browser chrome:** no text selection, no long-press callout, no tap highlight, no overscroll
  glow or pull-to-refresh. Only lists inside panels scroll; the page never does.
- **Gestures:** swipe and drag always have a visible button that does the same thing. Reserved:
  two-finger hold (kiosk exit) and press-and-hold on the rail clock (demo drawer).
- **No on-screen keyboard** where it can be avoided. Use pickers, steppers, chips and suggestion
  lists. If text input is needed, it goes in a sheet that leaves room for the keyboard.
- **Legible from across the room:** body text at least `--fs-body` (20px), labels at least
  `--fs-min` (14px), with strong contrast. Kids are users: prefer icons with labels, and confirm
  destructive actions with undo (toast), not a dialog.
- **Writes are optimistic:** apply immediately, show pending, roll back with a toast on error.

## Performance rules

- **Animate only `transform` and `opacity`.** Never animate layout properties (width, height, top,
  left, margin) or paint-heavy ones (`box-shadow`, `filter`, colors over large areas).
- **Paint-heavy CSS is banned:** `backdrop-filter`, `filter: blur()`, large or animated
  `box-shadow`, large gradients, `mix-blend-mode`. Use flat fills and borders. Shadows only small,
  static, and on small elements.
- **Keep the DOM small:** no off-screen lists of hundreds of nodes. Window or paginate long lists.
  Hidden views use `content-visibility`, as the router already does.
- **Big read-only data uses `$state.raw`** (calendar events, photos) and is replaced whole. Deep
  `$state` proxies are for small, edited state. Use keyed `{#each}` always.
- **During a gesture:** no allocation-heavy work, no layout reads after writes, and DOM updates
  batched to `requestAnimationFrame`. Drags move with `transform` only.
- **Images:** sized to how they're displayed, never full-resolution photos scaled down by CSS.
- **Fonts:** keep the font files few and small. Don't add families or weights without asking.
- Timers and intervals (clocks, polling) stop when their view is hidden.

## Live data

- **Live data replaces mocks in place**, so the views don't change shape. Keep the mock data as the
  fallback when an API is unreachable, and for local dev. Show stale data with an indicator rather
  than an empty screen.

## Verifying work

- There is no test suite or linter. Do not invent `npm test` / `npm run lint`.
- Dashboard: `cd dashboard && npm run check && npm run build` must pass (svelte-check, then Vite).
  TypeScript stays on 6.x until `svelte-check` supports 7. For UI changes, also run `npm run dev` and
  look at it in the browser.
- OpenAPI specs: lint them before calling a contract change done (see the API skill).
- **Never deploy.** The user runs deploys themselves (`deploy-dashboard` skill). Also never run
  `npm run deploy` or `wrangler`: that script still publishes to upstream's Cloudflare setup.

## Skills

- `api-contract`: design or change a service API (OpenAPI spec, prose doc, Redocly lint).
- `wire-feed`: replace a mock `DATA` feed with live data, or add a UI write.
- `run-dashboard`: build, WebView 106 checks, run and look at it in the browser.
- `mock-service`: Prism mock from a spec, and the Vite `/api` proxy.
- `deploy-dashboard`: copy the build to the Mac mini. Runs only when the user invokes it.

Node: these tools need 20.19+ or 22.12+. On the owner's Mac, nvm's default is 20.5.1, so use
`PATH=/usr/local/bin:$PATH` (Node 22). Elsewhere, check `node --version` first.

## Running in GitHub Actions

Claude also runs from GitHub: `.github/workflows/claude.yml` (`@claude` on issues and PRs) and
`claude-code-review.yml` (automatic PR review). There:

- **There's no browser and no device.** The checks you can run are the type check, the build, the
  WebView 106 greps, Redocly lint and the Prism mock. Say plainly in the PR or comment that UI changes
  weren't looked at.
- Check `node --version` before `npm` commands. If it's older than 20.19, say so; don't work around
  it by changing dependency versions.
- The repo rules still apply: never deploy, never merge, never touch upstream
  `wesbos/photo-frame-dashboard`, and work on a branch with a PR to `main`.

## Known loose ends (don't "fix" without asking)

- `dashboard/kiosk/.../MainActivity.java` `DEFAULT_URL` still points at the upstream deployment.
  It's only used until a frame has a saved URL.
- `wrangler.jsonc`, the `wrangler` dependency and the `deploy` script in `package.json` are left
  over from Cloudflare. Remove them once frame-bridge serves the dashboard.
- API type generation (`openapi-typescript`, `npm run gen:api`) is added when the first feed is
  wired (`wire-feed` skill).

## Issue automation (agents)

`claude --agent orchestrator` runs the loop: issues labeled `ai-task` on
`donnie-ellis/photo-frame-dashboard` → `planner` → `coder` → `tester` → PR on branch `ai/<n>`.
It never merges or deploys. Every `gh` call needs `--repo donnie-ellis/photo-frame-dashboard`:
this is a fork with no `gh` default, so a bare `gh pr create` targets upstream. State is in
`.claude/state/queue.json`.

## Git

- Work on a branch, PR to `origin/main`. Commit prefixes follow history: `docs:`, `feat:`, `fix:`.
- Commit only when asked.

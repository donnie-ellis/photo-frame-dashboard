# Apple + Hue integration plan

Status: plan, not started. Written 2026-10-11. API contract v0.1.0 written 2026-10-12,
v0.2.0 (LAN hosting, per-frame tokens) 2026-10-13.

Goal: replace three mock feeds in `dashboard/js/data.js` with real data:

| Feed | Source | Access | Replaces |
| --- | --- | --- | --- |
| Calendar | Apple Calendar (iCloud) | Read only | `DATA.events` |
| Shopping list | Apple Reminders, "Shopping" list | Read (check-off later, optional) | `DATA.groceries`, `DATA.stores` |
| Lights | Philips Hue | Read state + toggle/dim | `DATA.devices` where `type: 'light'` (and `DATA.rooms`) |

## Decisions

- **Host:** the home server, an Intel Mac mini (already runs Homebridge). Because it is a Mac,
  EventKit is available, which is the only clean way to read upgraded Reminders lists.
- **Lights use the Hue Bridge local API, not HomeKit.** The Hue Bridge pairs natively with Apple
  Home, so nothing here touches the Home app setup. Homebridge is not involved.
- **One Swift service** ("frame-bridge") does all three feeds. EventKit requires Swift/ObjC, and one
  process means one privacy grant and one thing to deploy. Hue is plain HTTPS from the same process.
- **Served on the LAN, no Cloudflare.** frame-bridge serves the built dashboard and the API from one
  origin. The frames and the Mac mini share a network, so a Worker, Tunnel and Access add setup and
  secrets for nothing. It also keeps working when the internet is down (except weather) and keeps
  Hue taps local. Cost: no access from outside the house (add Tailscale if that's ever wanted), and
  if the Mac mini is down the frame shows an error page instead of stale data.
- **One token per frame.** See [Auth](#auth-per-frame-tokens).

### Rejected options and why

- **iCloud CalDAV from the Worker:** works for calendars, but not needed now that EventKit is local.
  Keep it as the fallback if the Mac ever goes away.
- **Reminders over CalDAV:** lists upgraded to the iOS 13+ Reminders format moved to CloudKit and
  are no longer served over CalDAV.
- **Cloudflare Worker + Tunnel + Access** (the v0.1.0 design): only needed to reach the house from
  outside, which the frames don't need.
- **Reminders via a Shortcuts push** ("Find Reminders" → POST on "When Reminders is closed"):
  works without a Mac, but is not real-time for other people's edits and is display-only.
  Fallback only.
- **HomeKit framework / Home Assistant HomeKit Controller:** unnecessary for Hue, and HomeKit
  Controller pairing would pull accessories out of Apple Home.

## Architecture

```
Frames (WebView 106 kiosk, one token each)
   │  HTTP on the LAN, cookie frame_token
Mac mini: frame-bridge (Swift, LaunchAgent, <mac-ip>:8787)
   ├─ /         ── built dashboard (dashboard/dist/)
   ├─ EventKit ── Calendar (read only)
   ├─ EventKit ── Reminders "Shopping"
   └─ HTTPS ───── Hue Bridge CLIP v2 (LAN)
```

Give the Mac mini a DHCP reservation and use its IP in the frame URL: Android 6 can't be relied on
to resolve `.local` names.

### Auth: per-frame tokens

The goal is keeping casual guests on the Wi-Fi from finding the server and flipping lights, not
stopping a determined attacker.

- frame-bridge keeps a named list of frames with a **hash** of each token (e.g. `kitchen`,
  `hallway`). A token can be revoked on its own, and logs say which frame made each request.
- Every request, including the static dashboard files, needs the `frame_token` cookie; otherwise
  `401`. Compare hashes in constant time.
- The **kiosk app** stores the URL and token on the frame (set once over adb, see
  `dashboard/kiosk/MainActivity.java`) and sets the cookie for the bridge's origin before loading
  the page. A cookie rather than a header, because `EventSource` can't send headers. Dashboard code
  never sees the token.
- Plain HTTP: anyone with the Wi-Fi password could sniff a token. Acceptable for the goal above. If
  that changes, add HTTPS with a self-signed cert pinned in the kiosk app. A guest Wi-Fi network,
  if the router has one, keeps guests off this network entirely.
- Generate tokens with e.g. `openssl rand -hex 32` (hex is safe in a cookie value). Never commit them.

## API contract (frame-bridge)

The contract is [`api/frame-bridge.openapi.yaml`](api/frame-bridge.openapi.yaml) (v0.2.0). It is the
source of truth for paths, schemas and errors. This section only explains the choices behind it.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/calendar?from&to` | Events overlapping a range (max 120 days), recurring events expanded |
| `GET /api/shopping` | Stores + items from the Reminders "Shopping" list |
| `GET /api/lights` | Hue rooms + lights |
| `PUT /api/lights/{id}` | `{ on?, level? }` |
| `GET /api/events` | SSE: `calendar`, `shopping` (re-fetch notices), `light` (full object) |
| `GET /healthz` | Per-feed status, `updatedAt`, `staleAfterSeconds`, EventKit authorization |

### Field mapping (source → dashboard)

Field names follow what `dashboard/js/views/*.js` reads, not the source APIs.

| Dashboard | Source |
| --- | --- |
| `Event.id` | `EKEvent.eventIdentifier` + `:` + `occurrenceDate` (ISO 8601) |
| `Event.loc` | `EKEvent.location` |
| `Event.notes` | `EKEvent.notes` |
| `Event.people` | calendar name → person ids, from config. A "Family" calendar maps to every person |
| `Event.end` (all-day) | midnight after the last day, **not** EventKit's 23:59:59 |
| `ShoppingItem.id` | `EKReminder.calendarItemIdentifier` |
| `ShoppingItem.name` / `qty` | reminder title, with a leading number split off into `qty` (default 1) |
| `ShoppingItem.note` | `EKReminder.notes` |
| `ShoppingItem.done` | `isCompleted`, completed items kept for a few hours |
| `ShoppingItem.cat` / `store` | keyword → category/store map in frame-bridge config |
| `Light.id` / `Room.id` | Hue CLIP v2 `light` / `room` resource ids |
| `Light.level` | `dimming.brightness`, rounded, min 1. Kept while off |

### Contract decisions

- **`location` → `loc`.** The earlier draft of this doc used `location`. The views read `e.loc`.
- **No `calendar` field on events.** No view reads it. The calendar → person mapping happens in
  frame-bridge.
- **`travel` is optional and not sent in v0.1.** The views use it for "Leave by", but EventKit has no
  public travel-time field. Events without it simply show no leave-by time.
- **`/api/shopping` returns `{ stores, items }`, not a bare array.** `views/shopping.js` crashes on a
  `store` id missing from `DATA.stores`, so the stores come from the same config as the item mapping.
- **`cat` is an enum** of the dashboard's categories plus `Other`, matching `catOrder` in `data.js`.
- **No `PUT /api/rooms/{id}` yet.** No dashboard control toggles a whole room. Add it with
  scenes (a scene now sends one `PUT` per light, which Hue rate-limits at about 10/s).
- **Auth (v0.2.0):** a per-frame `frame_token` cookie, checked by frame-bridge itself. See
  [Auth](#auth-per-frame-tokens).
- **Read only for calendar and shopping.** Writes are separate, later changes.

## Implementation notes

### EventKit on the Mac mini

- Must be an **`.app` bundle**, not a bare binary, or macOS never shows the privacy prompt.
  Minimal headless app: `LSUIElement = YES`, plus `NSCalendarsFullAccessUsageDescription` and
  `NSRemindersFullAccessUsageDescription` in Info.plist.
- Use the macOS 14+ APIs: `requestFullAccessToEvents()` and `requestFullAccessToReminders()`.
  Approve once in System Settings → Privacy & Security.
- Needs a logged-in user session for EventKit and iCloud sync: enable auto-login, run as a
  **LaunchAgent** (not a LaunchDaemon), disable sleep.
- Intel Mac minis top out at macOS 15 Sequoia. Fine for these APIs.
- Subscribe to `EKEventStoreChanged` and re-query; debounce, since it fires in bursts.
- Read only for calendar: never call `save`/`remove` on `EKEvent`. Reminders writes (check-off)
  are a later, explicit feature.
- HTTP framework: Hummingbird (lighter) or Vapor.

### Hue Bridge (CLIP v2)

- One-time: press the bridge link button, `POST /api` with
  `{"devicetype":"frame-bridge#macmini","generateclientkey":true}` to get the application key.
  Store it in the Keychain, not in the repo.
- Requests: `https://<bridge-ip>/clip/v2/resource/...` with header `hue-application-key`.
  The bridge uses a self-signed cert: pin it instead of disabling verification.
- State: `resource/light`, `resource/room`, `resource/grouped_light`. Toggle with
  `PUT resource/light/{id}` body `{"on":{"on":true},"dimming":{"brightness":60}}`.
- Live updates: `GET /eventstream/clip/v2` (SSE). Relay into `/api/events`.
- Give the bridge a DHCP reservation.

### Serving the dashboard

- frame-bridge serves a directory of static files at `/` (the copied `dashboard/dist/`) and the API
  under `/api`. Unknown paths under `/api` are `404`, not the dashboard.
- `index.html` must not be cached (`Cache-Control: no-cache`), so a new deploy is picked up on
  reload. The hashed files under `/assets` can be cached for a long time.
- Deploy is copying `dist/` to the Mac mini (e.g. `rsync -a --delete`). Keep the previous copy
  for rollback.

### Dashboard side

- Add a small `api.js` that fetches the three feeds and populates `window.DATA` in place, so
  `views/calendar.js`, `views/shopping.js`, and `views/control.js` keep working unchanged.
- Keep mock data as the fallback when the API is unreachable (useful for local dev too).
- `App.setDevice` in `views/control.js` becomes a `PUT /api/lights/{id}` with optimistic update
  and rollback on error.
- Remove or hide non-light device tiles (blinds, locks, garage, cameras, climate) until those
  have real sources.
- Target WebView 106: no syntax newer than what `vite.config.js` already targets.

## Phases

1. **Skeleton:** frame-bridge app bundle, LaunchAgent plist, `/healthz`, token check, static
   dashboard files. Point the kiosk app at it.
2. **Lights:** Hue key setup, `/api/lights`, toggles, SSE relay, wire `control.js`.
3. **Calendar:** EventKit read, calendar→person map, wire `calendar.js`, hide "Add to calendar".
4. **Shopping:** EventKit reminders from "Shopping", category/store strategy, live updates,
   wire `shopping.js`.
5. **Hardening:** stale-data indicator, logs, restart on crash
   (`KeepAlive` in the plist), document setup in this file.

## Open questions

- Which calendars to show, and the calendar → person mapping. The spec examples use the mock person
  ids (`maya`, `jordan`, ...). Real ids replace the mock family in `data.js`.
- Category/store strategy for shopping items. The contract assumes the server-side keyword map;
  the list of stores is still open.
- A source for `travel` (drive time) on events, if "Leave by" is wanted.
- Check items off from the frame? (Needs Reminders write access; easy with EventKit.)

## Breaking changes

- **v0.2.0:** the Cloudflare Access headers (`CF-Access-Client-Id`, `CF-Access-Client-Secret`) are
  replaced by the `frame_token` cookie, and the tunnel server is gone. frame-bridge must check the
  token itself and serve the dashboard. (A minor bump because the version is still 0.x and nothing
  implements v0.1.0 yet.)

## Secrets (never commit)

Hue application key, pinned Hue cert, frame tokens. Keychain (or a config file outside the repo) on
the Mac; each frame's token lives only on that frame.

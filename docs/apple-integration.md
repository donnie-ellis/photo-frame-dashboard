# Apple + Hue integration plan

Status: plan, not started. Written 2026-10-11. API contract v0.1.0 written 2026-10-12.

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

### Rejected options and why

- **iCloud CalDAV from the Worker:** works for calendars, but not needed now that EventKit is local.
  Keep it as the fallback if the Mac ever goes away.
- **Reminders over CalDAV:** lists upgraded to the iOS 13+ Reminders format moved to CloudKit and
  are no longer served over CalDAV.
- **Reminders via a Shortcuts push** ("Find Reminders" → POST on "When Reminders is closed"):
  works without a Mac, but is not real-time for other people's edits and is display-only.
  Fallback only.
- **HomeKit framework / Home Assistant HomeKit Controller:** unnecessary for Hue, and HomeKit
  Controller pairing would pull accessories out of Apple Home.

## Architecture

```
Frame (WebView 106 kiosk)
   │  HTTPS
Cloudflare Worker (home-dashboard)  ── serves dashboard, proxies /api/*, caches
   │  Cloudflare Tunnel + Access service token
Mac mini: frame-bridge (Swift, LaunchAgent, localhost:8787)
   ├─ EventKit ── Calendar (read only)
   ├─ EventKit ── Reminders "Shopping"
   └─ HTTPS ───── Hue Bridge CLIP v2 (LAN)
```

Alternative to the Worker hop: serve the built dashboard from frame-bridge on the LAN and point
`DEFAULT_URL` in the kiosk app at it. Simpler, no tunnel, but loses the Cloudflare deploy flow.
Decide in phase 5.

## API contract (frame-bridge)

The contract is [`api/frame-bridge.openapi.yaml`](api/frame-bridge.openapi.yaml) (v0.1.0). It is the
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

### Contract decisions (v0.1.0)

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
- **Auth:** both `CF-Access-Client-Id` and `CF-Access-Client-Secret`, checked by Cloudflare Access at
  the edge. frame-bridge itself does no auth, so it must only listen on localhost/LAN.
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

### Worker side

- Proxy `/api/*` to the tunnel hostname, adding the Access service token headers
  (`CF-Access-Client-Id`, `CF-Access-Client-Secret`) from Worker secrets.
- Cache: calendar 5 min, shopping 30 s, lights not cached.
- SSE through the Worker works but keep an eye on connection limits; the frame can fall back to
  polling every 30 s.

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

1. **Skeleton:** frame-bridge app bundle, LaunchAgent plist, `/healthz`, Cloudflare Tunnel + Access.
2. **Lights:** Hue key setup, `/api/lights`, toggles, SSE relay, wire `control.js`.
3. **Calendar:** EventKit read, calendar→person map, wire `calendar.js`, hide "Add to calendar".
4. **Shopping:** EventKit reminders from "Shopping", category/store strategy, live updates,
   wire `shopping.js`.
5. **Hardening:** stale-data indicator, Worker vs local hosting decision, logs, restart on crash
   (`KeepAlive` in the plist), document setup in this file.

## Open questions

- Which calendars to show, and the calendar → person mapping. The spec examples use the mock person
  ids (`maya`, `jordan`, ...). Real ids replace the mock family in `data.js`.
- Category/store strategy for shopping items. The contract assumes the server-side keyword map;
  the list of stores is still open.
- A source for `travel` (drive time) on events, if "Leave by" is wanted.
- Check items off from the frame? (Needs Reminders write access; easy with EventKit.)
- Keep the Cloudflare Worker, or serve locally from the Mac mini?

## Secrets (never commit)

Hue application key, pinned Hue cert, Access service token. Keychain on the Mac, Worker secrets in
Cloudflare.

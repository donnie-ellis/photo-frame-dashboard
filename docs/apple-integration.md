# Apple + Hue integration plan

Status: plan, not started. Written 2026-10-11.

Goal: replace three mock feeds in `dashboard/js/data.js` with real data:

| Feed | Source | Access | Replaces |
| --- | --- | --- | --- |
| Calendar | Apple Calendar (iCloud) | Read only | `DATA.events` |
| Shopping list | Apple Reminders, "Shopping" list | Read (check-off later, optional) | `DATA.groceries` |
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

Shapes match the existing mock objects so the views need minimal changes.

### `GET /api/calendar?from=ISO&to=ISO`

```json
[{ "id": "eventIdentifier:occurrenceDate", "title": "Dentist", "start": "2026-10-12T14:00:00-04:00",
   "end": "2026-10-12T15:00:00-04:00", "allDay": false, "people": ["donnie"], "calendar": "Family",
   "location": "..." }]
```

- `people` comes from a config map of calendar name → person id (matches `DATA.people`).
- Recurring events are expanded by EventKit (`predicateForEvents`), so each occurrence needs a
  unique id: event identifier + occurrence start.
- Calendar view's "Add to calendar" sheet must be disabled or hidden: calendar is read only.

### `GET /api/shopping`

```json
[{ "id": "calendarItemIdentifier", "name": "Bananas", "note": "Bunch, not too ripe",
   "done": false, "qty": 1, "cat": "Produce", "store": "grocer" }]
```

- `name` = reminder title, `note` = reminder notes, `done` = isCompleted (include items completed in
  the last few hours so they can show struck through).
- `cat` / `store`: Reminders has no fields for these. Options, decide in phase 4:
  sections in the Reminders list (not exposed by EventKit), a prefix/tag convention in the
  title or notes (e.g. `#costco`), or a server-side keyword → category map. Default to the map.
- `qty`: parse a leading number from the title ("3 avocados"), else 1.

### `GET /api/lights`

```json
{ "rooms": [{ "id": "<hue room id>", "name": "Kitchen" }],
  "devices": [{ "id": "<hue light id>", "room": "<hue room id>", "type": "light",
                "name": "Pendants", "on": true, "level": 80 }] }
```

### `PUT /api/lights/{id}` body `{ "on": true, "level": 60 }`
### `PUT /api/rooms/{id}` body `{ "on": false }` (uses the room's `grouped_light`)

### `GET /api/events` (SSE)

Pushes `calendar`, `shopping`, and `light` change events so the frame updates without polling.

### `GET /healthz`

Reports EventKit authorization status for both entity types, Hue reachability, and last-update
timestamps. The dashboard shows a stale-data indicator when a feed is older than its threshold.

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

- Which calendars to show, and the calendar → person mapping.
- Category/store strategy for shopping items.
- Check items off from the frame? (Needs Reminders write access; easy with EventKit.)
- Keep the Cloudflare Worker, or serve locally from the Mac mini?

## Secrets (never commit)

Hue application key, pinned Hue cert, Access service token. Keychain on the Mac, Worker secrets in
Cloudflare.

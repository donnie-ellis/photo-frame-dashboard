# frame-bridge integration plan (Apple, Hue, weather)

Status: plan, not started. Written 2026-10-11. API contract v0.1.0 written 2026-10-12,
v0.2.0 (LAN hosting, per-frame tokens) 2026-10-13, v0.3.0 (weather, photos) 2026-10-13,
v0.4.0 (room and zone control, scenes) 2026-10-13, v0.5.0 (shopping check-off) 2026-10-14, v0.6.0 (lights change notice) 2026-10-14,
v0.7.0 (light color and temperature) 2026-10-15, v0.8.0 (Sonos now playing) 2026-10-15, v0.10.0 (photo focus) 2026-10-15.

Goal: replace these mock feeds in `dashboard/js/data.js` with real data:

| Feed | Source | Access | Replaces |
| --- | --- | --- | --- |
| Calendar | Apple Calendar (iCloud) | Read only | `DATA.events` |
| Shopping list | Apple Reminders, "Shopping" list | Read + check off | `DATA.groceries`, `DATA.stores` |
| Lights | Philips Hue | Read state + toggle/dim | `DATA.devices` where `type: 'light'` (and `DATA.rooms`) |
| Weather | Open-Meteo | Read only | `DATA.weather` |
| Photos | Apple Photos: "Frame" album + "On this day" | Read only | `DATA.photos` |
| Now playing | Sonos (local UPnP, one room) | Read only | `DATA.media` (no view reads it yet; the card is a separate issue) |

People's status (`status`, `eta`, `home`) has no real source and is being removed from the UI (see
[People's status](#peoples-status)). The other mocks (chores, climate, media, cameras, agents) are
out of scope here.

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
- **Weather from Open-Meteo, fetched by frame-bridge**, not the dashboard: the home coordinates stay
  on the Mac, all frames share one cached forecast, and the last forecast survives an internet
  outage. Free, no API key.
- **Photos through PhotoKit, like the Apple TV screensaver:** one album named "Frame" (a regular
  album, or a Shared Album that is never upgraded, see [Photos](#photos-photokit)) plus "On this day" from the whole
  library. The Mac resizes images for the frame.
- **Sonos now playing is display only, from one room.** No play, pause, skip or volume: frame-bridge
  never sends a write action to Sonos. If the room is grouped, the group's track is shown, read
  from the group coordinator.
- **Sonos over local UPnP (port 1400), not the Sonos cloud API.** The cloud API needs OAuth and
  internet. Open-Meteo stays frame-bridge's only internet call.
- **Polling (about 5 s while playing, 15 s otherwise), not GENA subscriptions.** GENA needs an
  unauthenticated NOTIFY callback route, which breaks "the token middleware covers every route".
- **Album art only when the speaker hosts it** (`/getaa`). External art URLs (some radio) mean no
  art, so no extra internet calls.

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
- **WeatherKit:** needs the paid Apple Developer Program. Open-Meteo has what the views read.
- **Weather from the dashboard directly:** would put the home location in the frontend and make
  every frame fetch it.
- **Memories / Featured Photos:** not exposed to third-party apps by PhotoKit (as far as we know).
  "On this day" is rebuilt from photo dates instead.

## Architecture

```
Frames (WebView 106 kiosk, one token each)
   │  HTTP on the LAN, cookie frame_token
Mac mini: frame-bridge (Swift, LaunchAgent, <mac-ip>:8787)
   ├─ /         ── built dashboard (dashboard/dist/)
   ├─ EventKit ── Calendar (read only)
   ├─ EventKit ── Reminders "Shopping"
   ├─ PhotoKit ── Photos: "Frame" album + "On this day"
   ├─ HTTPS ───── Hue Bridge CLIP v2 (LAN)
   └─ HTTPS ───── Open-Meteo (internet)
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
  `dashboard/kiosk/src/com/wesbos/homehq/MainActivity.java`) and sets the cookie for the bridge's origin before loading
  the page. A cookie rather than a header, because `EventSource` can't send headers. Dashboard code
  never sees the token.
- Plain HTTP: anyone with the Wi-Fi password could sniff a token. Acceptable for the goal above. If
  that changes, add HTTPS with a self-signed cert pinned in the kiosk app. A guest Wi-Fi network,
  if the router has one, keeps guests off this network entirely.
- Generate tokens with e.g. `openssl rand -hex 32` (hex is safe in a cookie value). Never commit them.

## API contract (frame-bridge)

The contract is [`api/frame-bridge.openapi.yaml`](api/frame-bridge.openapi.yaml) (v0.10.0). It is the
source of truth for paths, schemas and errors. This section only explains the choices behind it.

| Endpoint | Purpose |
| --- | --- |
| `GET /api/calendar?from&to` | Events overlapping a range (max 120 days), recurring events expanded |
| `GET /api/shopping` | Stores + items from the Reminders "Shopping" list |
| `PATCH /api/shopping/{id}` | `{ done }`: check off or un-check a reminder |
| `GET /api/lights` | Hue rooms and zones, lights, scenes |
| `PUT /api/lights/{id}` | `{ on?, level?, temp?, color? }` (`temp` and `color` not together) |
| `PUT /api/rooms/{id}` | `{ on?, level? }`, for a room or zone (one Hue `grouped_light` request) |
| `POST /api/scenes/{id}/recall` | Activate a scene |
| `GET /api/weather` | Today's high/low and 48 hourly temperature, condition and rain-chance values |
| `GET /api/photos` | The "Frame" album (sampled) plus "On this day" photos |
| `GET /api/photos/{id}/image?size=full\|half` | The photo as a JPEG, resized on the Mac |
| `GET /api/nowplaying` | What is playing on the Sonos room: `state`, and `title`, `artist`, `album`, `art`, `source` when known |
| `GET /api/nowplaying/art?size=full\|half` | The current track's album art as a JPEG, resized on the Mac. `404` when none |
| `GET /api/events` | SSE: `calendar`, `shopping`, `weather`, `photos`, `lights` (re-fetch notices), `light`, `room`, `scene`, `nowplaying` (full objects) |
| `GET /healthz` | Per-feed status, `updatedAt`, `staleAfterSeconds`, privacy authorization |

### Field mapping (source → dashboard)

Field names follow what `dashboard/js/views/*.js` and `dashboard/src/views/` read, not the source APIs.

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
| `Light.id` / `Room.id` | Hue CLIP v2 `light` / `room` or `zone` resource ids |
| `Scene.icon` | scene name → icon map in frame-bridge config, omitted if unmapped |
| `Light.level` | `dimming.brightness`, rounded, min 1. Kept while off |
| `Light.temp` | `1e6 / color_temperature.mirek`, rounded, only when `mirek_valid` |
| `Light.tempRange` | `color_temperature.mirek_schema` (max mirek is min K, min mirek is max K) |
| `Light.color` | `color.xy` + `dimming` converted to sRGB hex, clamped to the gamut |
| `Weather.hi` / `lo` | Open-Meteo `daily.temperature_2m_max` / `_min`, today |
| `Weather.t` / `p` | `hourly.temperature_2m` (rounded) / `hourly.precipitation_probability` |
| `Weather.c` | `hourly.weather_code` + `hourly.is_day` → condition name (table in the spec) |
| `Photo.id` | `PHAsset.localIdentifier` |
| `Photo.o` | `pixelWidth` vs `pixelHeight` |
| `Photo.date` | `creationDate`, as a local date |
| `Photo.place` | `location`, reverse-geocoded (`CLGeocoder`) to a short name, cached per asset |
| `Photo.tag` | same day + within a few km, computed by frame-bridge |
| `Photo.fav` | `isFavorite` |
| `Photo.focus` | Vision (faces → people → saliency) union, padded, flipped to top-left origin, cached per asset |
| `NowPlaying.room` | config `room` (ZoneGroupTopology on `host` finds its group coordinator) |
| `NowPlaying.title` / `artist` / `album` | DIDL-Lite `dc:title` / `dc:creator` / `upnp:album` |
| `NowPlaying.art` | `upnp:albumArtURI` as a speaker-relative `/getaa` path: `true`. An external URL: `false` |
| `NowPlaying.state` | `CurrentTransportState`: `PLAYING` → `playing`, `PAUSED_PLAYBACK` → `paused`, `STOPPED` / `NO_MEDIA_PRESENT` → `stopped`. `TRANSITIONING` keeps the last state (no SSE); a first read while `TRANSITIONING` → `playing` |
| `NowPlaying.source` | track URI scheme: `x-sonos-htastream:` → `tv`, `x-rincon-stream:` → `lineIn`, otherwise `music` |

### Contract decisions

- **`location` → `loc`.** The earlier draft of this doc used `location`. The views read `e.loc`.
- **No `calendar` field on events.** No view reads it. The calendar → person mapping happens in
  frame-bridge.
- **`travel` is optional and not sent in v0.1.** The views use it for "Leave by", but EventKit has no
  public travel-time field. Events without it simply show no leave-by time.
- **`/api/shopping` returns `{ stores, items }`, not a bare array.** The shopping view needs every
  item's `store` id to exist in `stores`, so the stores come from the same config as the item mapping.
- **`cat` is an enum** of the dashboard's categories plus `Other`, matching `catOrder` in `data.js`.
- **Room and zone control, scenes (v0.4.0, additive).** `PUT /api/rooms/{id}` takes the same
  `LightPatch` and works for rooms and zones. It is one Hue `grouped_light` request, so a whole-room
  change doesn't need one `PUT` per light (Hue rate-limits at about 10/s). `POST
  /api/scenes/{id}/recall` is one request too (`PUT resource/scene/{id}`,
  `{"recall":{"action":"active"}}`). `Room.kind` is `room | zone` and `Room.lights` holds
  membership, because a light can be in several zones; `Light.room` stays its one Hue room.
  `Room.on` is true if any light is on. `Scene.active` is true when Hue's `scene.status.active`
  isn't `inactive`. The names were proposed in issue #16.
- **Scene icons come from frame-bridge.** The control view draws an icon per scene, and Hue has no
  icon name for a scene. frame-bridge maps scene names to icon names in its config, as it does for
  weather conditions. The map is keyed by name, not id, because "Dinner" in two rooms is two Hue
  scenes. Unmapped scenes have no `icon`, and the dashboard shows `bulb`.
- **Default room is not in the API.** Each frame's default room is picked on screen and stored in
  the dashboard's `localStorage`.
- **Hue stays inside frame-bridge** with a hand-written CLIP v2 client. The
  [OpenHue spec](https://github.com/openhue/openhue-api) is only a reference for models.
- **Auth (v0.2.0):** a per-frame `frame_token` cookie, checked by frame-bridge itself. See
  [Auth](#auth-per-frame-tokens).
- **Calendar is read only.** Writes are separate, later changes.
- **Shopping check-off (v0.5.0, additive):** `done` is the only writable field and maps to
  `EKReminder.isCompleted`. The bridge sets it, calls `EKEventStore.save(_:commit:)`, and returns the
  updated `ShoppingItem`. It then sends a `shopping` change notice so other frames re-fetch.
  `done: false` un-checks, for undo. Ids must be percent-encoded in the path.
- **Lights change notice (v0.6.0, additive).** In-place changes arrive as `light`/`room`/`scene`.
  Anything structural arrives as one debounced `lights` ChangeNotice, and the dashboard re-fetches
  `/api/lights`: a light, room/zone or scene added or deleted, or a light leaving every kept room.
  Removals show up live.
- **Light color and temperature (v0.7.0, additive).** The sheet reads warm-cool and swatches, so
  the contract uses Kelvin and `#rrggbb`, not mirek and xy. Capability is shown by presence:
  `tempRange` means white temperature, `color` means colour. `temp` is present only in white mode,
  and `color` stays as an approximation. Setting `color` leaves white mode and setting `temp`
  returns to it, as in Hue, so sending both is a 400. Rooms are out for now, so `PUT /api/rooms/{id}`
  uses a separate `RoomPatch` (`{ on?, level? }`) and its body is unchanged. The white presets
  (Candle 2200, Warm 2700, Soft 3000, Neutral 4000, Daylight 5000, Cool 6500 K) live in the
  dashboard and are sent as `temp`.
- **Weather (v0.3.0) keeps the dashboard's shape** (`hi`, `lo`, and the parallel arrays `t`, `c`,
  `p`), but has 48 hours instead of 24 and a `start` time. The mock's 24 entries wrap around
  midnight, which shows today's early hours as "next" late at night. `feels`, `humidity` and `wind`
  are in the mock but no view reads them, so they aren't in the contract.
- **Weather adds `snow` and `storm` conditions.** The mock only has five icons. The dashboard needs
  icons and labels for them when the feed is wired.
- **Photos have `id` instead of `seed`.** The image URL is `/api/photos/{id}/image`, and the
  dashboard builds it (`photoSrc` in `src/lib/state/photos.svelte.ts`, built on `photoUrl`). Two sizes only, so images cache well.
- **No `from` on photos.** PhotoKit doesn't seem to say who added a photo to a shared album. The
  slideshow caption has to work without it.
- **`fav` is read only.** Hide the favorite button until a write is added (it changes the Photos
  library, so it's a separate decision).
- **The album is sampled** (300 photos, re-shuffled daily, plus up to 30 "On this day"), so a big
  album doesn't make a big payload.
- **Sonos now playing (v0.8.0, additive).** `NowPlaying` has no track id: the dashboard builds the
  art cache-buster from title, artist and album. `art` is a boolean plus a fixed URL
  (`/api/nowplaying/art`), so the payload stays small. TV and line-in have no track fields. The
  card shows only when `state` is `playing` and `title` is present. `sonos` is **optional** in
  `Health.feeds`, so bridges without Sonos configured, and existing bridges, still validate; the
  dashboard tolerates a missing feed key.
- **Photo focus (v0.10.0, additive).** Crops cut off faces because the dashboard only knows `o`.
  `Photo.focus` is a box in fractions of the image, top-left origin, already padded, and omitted
  until computed or when nothing was found (the dashboard keeps its default crop). The dashboard
  only moves the crop (`object-position`) and clamps the Ken Burns drift so the box stays in view;
  it never zooms past `cover`. v0.9.0 belongs to #55.

## Implementation notes

### EventKit on the Mac mini

- Must be an **`.app` bundle**, not a bare binary, or macOS never shows the privacy prompt.
  Minimal headless app: `LSUIElement = YES`, plus `NSCalendarsFullAccessUsageDescription` and
  `NSRemindersFullAccessUsageDescription` in Info.plist.
- Use the macOS 14+ APIs: `requestFullAccessToEvents()` and `requestFullAccessToReminders()`.
  Approve once in System Settings → Privacy & Security.
- Needs a logged-in user session for EventKit and iCloud sync: enable auto-login, run as a
  **LaunchAgent** (not a LaunchDaemon), disable sleep.
- **Under launchd there is no privacy prompt.** The request is denied at once and the app shows up
  switched off in System Settings → Privacy & Security: switch it on there, once. Sign the bundle
  with a stable certificate (a self-signed one is enough), not ad hoc: an ad-hoc signature ties the
  grant to that exact build, so every deploy would lose it. Tested for Photos (frame-bridge #9);
  Calendars and Reminders are expected to match (frame-bridge #23).
- Intel Mac minis top out at macOS 15 Sequoia. Fine for these APIs (but see the
  Shared Album limit under [Photos](#photos-photokit)).
- Subscribe to `EKEventStoreChanged` and re-query; debounce, since it fires in bursts.
- Read only for calendar: never call `save`/`remove` on `EKEvent`. Reminders writes are limited to
  `isCompleted` on items in the Shopping list. It needs full Reminders access (already requested with
  `requestFullAccessToReminders`). Never create or delete reminders.
- HTTP framework: Hummingbird (lighter) or Vapor.

### Hue Bridge (CLIP v2)

- One-time: press the bridge link button, `POST /api` with
  `{"devicetype":"frame-bridge#macmini","generateclientkey":true}` to get the application key.
  Store it in the Keychain, not in the repo.
- Requests: `https://<bridge-ip>/clip/v2/resource/...` with header `hue-application-key`.
  The bridge uses a self-signed cert: pin it instead of disabling verification.
- State: `resource/light`, `resource/room`, `resource/grouped_light`. Toggle with
  `PUT resource/light/{id}` body `{"on":{"on":true},"dimming":{"brightness":60}}`.
  White temperature is `{"color_temperature":{"mirek":370}}` and colour is `{"color":{"xy":{...}}}`.
- Live updates: `GET /eventstream/clip/v2` (SSE). Relay into `/api/events`. Hue `update` events
  relay as `light`/`room`/`scene`. Hue add/delete events, and membership changes that move a light
  out of every kept room, become one debounced `lights` notice. The bridge sends it only when the
  set of light/room/scene ids changes after the throttled full read.
- Give the bridge a DHCP reservation.

### Photos (PhotoKit)

- Add `NSPhotoLibraryUsageDescription` to Info.plist and request `.readWrite` authorization
  (PhotoKit has no read-only level; frame-bridge still never writes). Approve once in System Settings → Privacy & Security → Photos.
- The album: `PHAssetCollection.fetchAssetCollections(with: .album, subtype: .any)` filtered by
  title from config. Shared albums are `subtype: .albumCloudShared`.
- "On this day": fetch images whose `creationDate` is today's month/day in earlier years. PhotoKit
  predicates can't match month/day directly, so query one day-range per year (cheap), or keep an
  index built at startup.
- Skip videos (`mediaType == .image`) and screenshots (`mediaSubtypes` contains
  `.photoScreenshot`).
- Images: `PHImageManager.requestImage` with a target size, `deliveryMode: .highQualityFormat`
  and `isNetworkAccessAllowed = true` (photos in iCloud with "Optimize Mac Storage" need a
  download). Encode JPEG, cache on disk by id + size.
- Changes: `PHPhotoLibraryChangeObserver` → `photos` SSE notice (debounced).
- **Focus** (`Photo.focus`) with Vision, in this order:
  1. `VNDetectFaceRectanglesRequest`, confidence ≥ 0.6, each box expanded about 50% wider and 65%
     taller for headroom.
  2. No faces: `VNDetectHumanRectanglesRequest` (`upperBodyOnly = false`), confidence ≥ 0.6.
  3. Neither: `VNGenerateObjectnessBasedSaliencyImageRequest` `salientObjects`, confidence ≥ 0.5.
     If their union covers more than 85% of the image, discard it and use
     `VNGenerateAttentionBasedSaliencyImageRequest` instead.

  Then take the union, pad about 3.5%, clip to [0,1] and flip y (`y = 1 - y - h`). Run in the
  background on the cached 1280 `full` JPEG, a few at a time, cached on disk per asset id, never in
  a request handler (like `place`). Send a debounced `photos` notice after a batch lands. Approach
  from matt416/homecontrol `macos/subject-analyzer/main.swift` (MIT), reference only, no code copied.
- **Shared album** (spike: frame-bridge #9). PhotoKit stores shared album photos as a JPEG at
  2048 px on the long edge, enough for the 1280 px `full` size, and cloud-only ones download in
  well under a second. `location` is missing on some, so `place` is sometimes omitted.
  `isFavorite` is always false for them: `fav` only means something for "On this day" photos.
- The observer fires every few seconds while iCloud syncs, mostly for unrelated changes. Rebuild
  only when `changeDetails(for:)` has something for the album or the "On this day" queries. A
  photo added from a phone showed up about 10–15 s later.
- **Never upgrade the Frame album.** "Frame" must be a regular album in the Mac mini's library, or
  a Shared Album that is never upgraded. Never accept the "upgrade Shared Album" prompt on any
  device (iPhone, iPad, Mac). The Intel Mac mini tops out at macOS 15, and Shared Albums
  created or upgraded on iOS, iPadOS or macOS 27 open only on 27 and later
  ([Apple](https://support.apple.com/en-us/108916)). The lookup above includes Shared Albums, so an
  upgraded album can drop out of view and the slideshow quietly empties.
- **Empty slideshow:** if `GET /api/photos` is empty while `/healthz` reports `photos` `ok`, open
  Photos on the Mac mini itself (not a phone) and check that "Frame" is still there and opens. If
  not, it was probably upgraded.

### Sonos (local UPnP)

- Config: `sonos: { host, room }`. `host` is the IP of any one speaker (give it a DHCP
  reservation, e.g. `192.0.2.10`), used to read the group topology. `room` is the name shown.
- ZoneGroupTopology on `host` finds the group coordinator for `room`. Then AVTransport
  `GetTransportInfo` and `GetPositionInfo` on the coordinator, at port 1400.
- Poll about every 5 s while playing, about every 15 s otherwise. Send a `nowplaying` SSE event only
  when the value changes.
- Art: fetch the coordinator's `/getaa` path, resize like photos (`full` / `half`), `Cache-Control:
  no-cache`, `404` when the track has none.
- Read only: no AVTransport or RenderingControl actions that change anything.

### Weather (Open-Meteo)

- `https://api.open-meteo.com/v1/forecast?latitude=…&longitude=…&hourly=temperature_2m,precipitation_probability,weather_code,is_day&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=2`
  (add `&temperature_unit=fahrenheit` if configured).
- Refresh about every 30 minutes; send a `weather` SSE notice when it changes. Serve the last good
  copy when a fetch fails.
- Free for non-commercial use, no key. Keep requests low anyway.

### Serving the dashboard

- frame-bridge serves a directory of static files at `/` (the copied `dashboard/dist/`) and the API
  under `/api`. Unknown paths under `/api` are `404`, not the dashboard.
- `index.html` must not be cached (`Cache-Control: no-cache`), so a new deploy is picked up on
  reload. The hashed files under `/assets` can be cached for a long time.
- The dashboard polls `/` every 15 s while visible. It reloads only after it sees the same new
  `/assets/` set twice and every new asset answers `HEAD` 200, and only when idle (no touch for
  30 s, day mode, not on Photos, no sheet, takeover or demo drawer open). A `401` or any other error
  keeps the current screen. This depends on the no-cache `index.html` above.
- Deploy is copying `dist/` to the Mac mini (e.g. `rsync -a --delete`). Keep the previous copy
  for rollback.

### Dashboard side

- Views are Svelte, registered with `registerView` in `src/main.ts`: Today (`src/views/today`),
  Calendar (`src/views/calendar`), Shopping (`src/views/shopping`), Photos (`src/views/photos`) and
  Home control (`src/views/control`). Still vanilla: the ambient and night overlays
  (`js/views/ambient.js`), and `tasks.js` and `agents.js` (sections in `index.html`, no rail button).
- Feeds live in Svelte stores (`src/lib/state/`: `calendar`, `shopping`, `weather`, `photos`, plus
  `lights`), fetched through `src/lib/api/frame-bridge.ts`. Each store starts from the `js/data.js`
  mock. The mock stays as the fallback when the bridge is unreachable.
- Only `events` (`calendar.svelte.ts`) and `weather` (`weather.svelte.ts`) are still written whole
  to `window.DATA` after each fetch (`writeLegacy` in `src/lib/state/feed.svelte.ts`), followed by
  `App.emit('data', <prop>)`. Reason: the helpers in `js/app.js` (`App.events`, `App.timedOn`,
  `App.nextEvent` read `DATA.events`; `App.weatherNow`, `App.hourly` read `DATA.weather`) are still
  used by `ambient.js` and by Svelte views (NextUp, Lanes, the calendar grids, the Today weather
  tile). `photos`, `groceries`/`stores` and lights are never written: the stores seed from the
  mock, and `lights.svelte.ts` never touches `DATA`. An unlabelled `App.emit('data')` (the demo
  drawer's calendar mode) makes `calendar.syncLegacy()` re-read `DATA.events`
  (`exposeFeeds` in `src/lib/legacy.svelte.ts`).
- The four non-light stores are activated once in `src/main.ts` and stay live for the page
  lifetime, because several views and the ambient screen read them. The SSE stream
  (`src/lib/api/events.ts`) is reference counted, with a 30 s poll if it fails, and `/healthz` is
  polled once a minute for all stores (stale indicator).
- Release 1 calendar fetch window: today minus 35 days to today plus 84 days. The view pages by
  day, week and month, and the spec allows up to 120 days. Reloads on `calendar` notices and when
  the local day changes.
- Shopping: once the feed has loaded (stale counts as loaded), the Svelte Shopping view has no add,
  suggestions/usuals, quantity steppers or "Clear checked items". Check-off and "Add back" stay
  (`setDone` in `src/lib/state/shopping.svelte.ts`, `PATCH` done), optimistic and rolled back with a
  toast on error.
- Shopping, planned but not specced. A later contract change would need: create
  (`POST /api/shopping` with `{ name, qty?, store? }`), `qty` in `ShoppingItemPatch`, delete or
  clear (`DELETE /api/shopping/{id}` or a bulk clear), and a suggestions source
  (`GET /api/shopping/suggestions`).
- The calendar view (`src/views/calendar`) is read-only: it has no add or edit UI, in mock mode too.
- Lights: the Home control view (`src/views/control`: Control, Lights, LightSheet, RoomPicker) has
  only lights. It uses `/api/lights`, `/api/rooms/{id}`, scene recall and the SSE events, with
  optimistic updates and rollback on error. `window.DATA` is untouched. Blinds, locks, garage,
  cameras and climate have no tiles until they have real sources.
- Weather: `App.hourly` indexes the 48-hour arrays without wrapping, and `snow`/`storm` have
  icons and labels. The Today weather tile calls the same helpers.
- Photos: one Slideshow (`src/views/photos/Slideshow.svelte`) is used by the Photos view, the Today
  tile (`src/views/today/PhotoTile.svelte`, cover layout, size half) and the ambient screen
  (`src/views/photos/ambient.svelte.ts` mounts it into `#ambient .amb-stage` on `ready` and follows
  `mode`; `ambient.js` still draws the overlay and clock). Image URLs are built from `id`
  (`photoSrc` in `src/lib/state/photos.svelte.ts`, built on `photoUrl`), sized by `imgSize` in
  `Slideshow.svelte`: full for cover, pair and collage (the Today tile passes half), half for
  polaroid. The "Favourite" button renders only while `photos.status === 'mock'` and toggles only
  the mock item; once the feed has loaded (stale counts) it is hidden. Captions cope with a missing
  `from` and `place`.
- Photo focus: `Crop.svelte` and `focus.ts` (`src/views/photos/`) set `object-position` from
  `Photo.focus` for cover crops (single, pair, collage, polaroid). Portrait singles (`.ss-fit`,
  contain) don't crop. The Ken Burns drift is clamped to keep the focus in view.
- The person ids in `js/data.js` are placeholders and must match frame-bridge's people config.
- Target WebView 106: no syntax newer than what `dashboard/vite.config.js` already targets.

### People's status

There's no usable source: Find My has no API, HomeKit presence isn't readable from a Mac service,
and ETA would need live location. The status text, ETA and the away styling are removed from the
UI; people stay as names, colours and avatars. If home/away is missed later, the best option is
iOS Shortcuts "Arrive/Leave home" automations on each adult's phone calling frame-bridge with a
per-phone token.

## Phases

1. **Skeleton:** frame-bridge app bundle, LaunchAgent plist, `/healthz`, token check, static
   dashboard files. Point the kiosk app at it.
2. **Lights:** Hue key setup, `/api/lights`, toggles, SSE relay.
3. **Calendar:** EventKit read, calendar→person map, wire the Calendar view (`src/views/calendar`), hide "Add to calendar".
4. **Shopping:** EventKit reminders from "Shopping", category/store strategy, live updates,
   check-off write (`PATCH /api/shopping/{id}`), wire the Shopping view (`src/views/shopping`).
5. **Weather:** Open-Meteo fetch and cache, `/api/weather`, wire the weather tiles.
6. **Photos:** shared album spike, PhotoKit read, image resize cache, "On this day", wire the
   slideshow.
7. **Sonos:** UPnP read, group coordinator, polling, `/api/nowplaying` and art, `nowplaying` SSE,
   `sonos` health. The dashboard card is a separate issue.
8. **Hardening:** stale-data indicator, logs, restart on crash
   (`KeepAlive` in the plist), document setup in this file.

## Open questions

- Which calendars to show, and the calendar → person mapping. The spec examples use the mock person
  ids (`maya`, `jordan`, ...). Real ids replace the mock family in `data.js`.
- Category/store strategy for shopping items. The contract assumes the server-side keyword map;
  the list of stores is still open.
- A source for `travel` (drive time) on events, if "Leave by" is wanted.
- Weather units: °C or °F (frame-bridge config).
- Replacing the Mac mini: macOS 27 and later lifts the Shared Album limit. Until then the
  never-upgrade rule stands (see [Photos](#photos-photokit)).

## Breaking changes

- **v0.2.0:** the Cloudflare Access headers (`CF-Access-Client-Id`, `CF-Access-Client-Secret`) are
  replaced by the `frame_token` cookie, and the tunnel server is gone. frame-bridge must check the
  token itself and serve the dashboard. (A minor bump because the version is still 0.x and nothing
  implements v0.1.0 yet.)

## Secrets (never commit)

Hue application key, pinned Hue cert, frame tokens, the home coordinates for weather, the Sonos speaker IP. Keychain (or a config file outside the repo) on
the Mac; each frame's token lives only on that frame.

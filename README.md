# Home HQ

A family dashboard on a wall-mounted Android photo frame: calendar, chores, shopping, photos,
lights, weather and what's playing, all from real household data. Everyone uses it by touch,
including the kids.

This started as a fork of [wesbos/photo-frame-dashboard](https://github.com/wesbos/photo-frame-dashboard)
and has fully diverged. We don't track upstream or send changes back.

## How it fits together

```
Calendar, Reminders, Photos ──┐
Hue Bridge, Sonos (LAN) ──────┼──> frame-bridge ──> http://<mac-ip>:8787 ──> kiosk app on the frame
Open-Meteo, Workers AI ───────┘    (Mac mini)       dashboard + API + SSE    (full-screen WebView)
```

| Part | Where it lives | What it does |
| --- | --- | --- |
| Dashboard | [`dashboard/`](dashboard), this repo | Svelte 5 + TypeScript web app, built by Vite |
| Kiosk app | [`dashboard/kiosk/`](dashboard/kiosk), this repo | Full-screen WebView Android app, and the frame's Home app |
| API contract | [`docs/api/frame-bridge.openapi.yaml`](docs/api/frame-bridge.openapi.yaml), this repo | The source of truth for the service. Change it first |
| frame-bridge | [donnie-ellis/frame-bridge](https://github.com/donnie-ellis/frame-bridge) | Swift service on the Mac mini. Serves the dashboard and the API from one origin |

Everything stays on the LAN, with no Cloudflare in front of it. Only weather and the optional day
summary need the internet, and the day summary is the one feed that sends household data out. The
Mac mini is a single point of failure: if it's down, the frame shows an error page and keeps
retrying. [apple-integration.md](docs/apple-integration.md) explains these decisions.

### What's on the screen

The rail has Today, Calendar, Chores, Shopping, Photos and Home.

| Feed | Source | Access |
| --- | --- | --- |
| Calendar | Apple Calendar | Read only |
| Shopping | Apple Reminders | Read, check off |
| Chores | Apple Reminders, one list per person | Read, check off |
| Photos | Apple Photos | Read only |
| Lights | Philips Hue, local API | Read, control |
| Weather | Open-Meteo | Read only |
| Now playing | Sonos, local UPnP | Read only |
| Day summary | Cloudflare Workers AI | Read only, optional |

If the bridge can't be reached, the feeds fall back to the mock data in `dashboard/js/data.js`. Data
that has gone stale stays on screen with an indicator.

### The frame

The only target is a frame sold as BIUFRAME that is really a **PF1007L**: Allwinner A33, AiMOR
firmware, USB-C only, 1280×800 landscape, Android 6 with WebView 106, 1 GiB RAM.

It is **not** the Rockchip "Synergy 10X1" BIUFRAME, despite the name. Never run
`scripts/biuframe-setup.sh` or Rockchip tools on it.

## Develop

You need Node 20.19+ or 22.12+. If `node --version` is older, try `PATH=/usr/local/bin:$PATH`.

```sh
cd dashboard
npm install
npm run dev      # http://localhost:5173, uses the mock data
```

Size the browser window to 1280×800, which is the frame's viewport. The touch kit gallery is at
`/kit.html`, and pressing and holding the rail clock opens the demo drawer.

To run against the API, start a Prism mock from the repo root, then point the dev server at it:

```sh
npx @stoplight/prism-cli mock docs/api/frame-bridge.openapi.yaml -p 4010
cd dashboard && API_TARGET=http://localhost:4010 FRAME_TOKEN=dev npm run dev
```

Set `API_TARGET` to `http://<mac-ip>:8787` and `FRAME_TOKEN` to a real token to use the live bridge.

Before calling a change done:

```sh
npm run check && npm run build
```

After changing the OpenAPI spec, regenerate the types with `npm run gen:api`.

The design, touch and performance rules for this hardware are in
[`.claude/CLAUDE.md`](.claude/CLAUDE.md). Read them before changing the UI. The weak GPU and old
WebView rule out a lot of ordinary CSS.

## Deploy

There are three pieces. A routine dashboard release is only the third.

| Piece | When | How |
| --- | --- | --- |
| [1. frame-bridge](#1-frame-bridge) | First install, or a new service version | Its own repo |
| [2. Kiosk on the frame](#2-kiosk-on-the-frame) | New frame, or a kiosk change | `adb` over USB |
| [3. Dashboard](#3-dashboard) | Every dashboard release | Copy `dashboard/dist/` to the Mac mini |

Placeholders below: `<user>` is the Mac mini's login user, `<mac-ip>` its LAN address, and `<token>`
a frame token. Keep the real values, the Mac's directory paths and all tokens out of this repo.

### 1. frame-bridge

Follow [Deployment in the frame-bridge README](https://github.com/donnie-ellis/frame-bridge#deployment).
In short:

1. Prepare the Mac mini: auto-login on, sleep off, signed in to iCloud, and DHCP reservations for
   the Mac and the Hue Bridge. Use the IP in the frame's URL, because Android 6 can't be relied on to
   resolve `.local` names.
2. Build the signed app, create `config.json` with the frame token hashes and `dashboardDir`, then
   run `install.sh`.
3. Switch on **FrameBridge** under Privacy & Security for Photos, Calendars and Reminders, then pair
   the Hue Bridge.

When the service changes, update the contract here first. The service repo then implements it.

### 2. Kiosk on the frame

**New frame.** Get root ADB and lock the frame down first, following
[pf1007l-start-here.md](docs/pf1007l-start-here.md). Our unit came with root ADB already on, so we
skipped the SD card and boot patch steps. Don't skip these two:

- [Disable the vendor apps](docs/aimor-remote-root-shell.md) before the frame stays online. The stock
  AiMOR app gives the vendor's server a root shell.
- [Install WebView 106](docs/allwinner-a33-pf1007l.md#6-upgrade-webview-before-using-the-kiosk).

Use a USB-A to USB-C data cable. USB-C to USB-C gives no power or data. ADB is over USB only, so
every command here uses `adb -d`.

**Build and install.** You need JDK 17, Android build-tools 34 and platform 34:

```sh
brew install openjdk@17
brew install --cask android-commandlinetools
sdkmanager --sdk_root=$ANDROID_HOME "build-tools;34.0.0" "platforms;android-34"

dashboard/kiosk/build.sh
adb -d install -r dashboard/kiosk/build/homehq.apk
```

**Point it at the bridge.** This is needed once per frame. The URL and token are saved on the frame,
and the token is sent as the `frame_token` cookie to that host only:

```sh
adb -d shell am start -n com.wesbos.homehq/.MainActivity \
  --es url http://<mac-ip>:8787/ --es token <token>
```

To create the token and add its hash to the config, see
[Issue a frame token](https://github.com/donnie-ellis/frame-bridge#issue-a-frame-token). Until a URL
is saved, the kiosk loads upstream's demo.

The kiosk has to be the default Home app, because the firmware only sends `BOOT_COMPLETED` to
whitelisted apps. That's how it starts at boot. Hold two fingers still for 1.5 s to exit to the other
launcher.

### 3. Dashboard

frame-bridge serves whatever is in `dashboardDir`, so deploying means copying the build there. In
Claude Code, the `/deploy-dashboard` skill walks through these steps. Claude never runs the copy.

**Don't use `npm run deploy`.** It's left over from upstream and publishes to Cloudflare.

**1. Start from a clean `main`.**

```sh
git switch main && git pull
git status --short    # expect no output
```

**2. Build and check it.**

```sh
cd dashboard
npm ci
npm run check && npm run build

# The WebView rejects 4- and 8-digit hex colors, and has no JS APIs newer than Chrome 106.
# Expect no output from either.
grep -oE '#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{4}\b' dist/assets/*.css
grep -rnE '\.(toSorted|toReversed|toSpliced|with)\(|Object\.groupBy|Map\.groupBy|Promise\.withResolvers|Array\.fromAsync' js src dist/assets
cd ..
```

**3. Copy it.** This keeps the current version as `<dashboardDir>.previous` for rollback.

```sh
MAC=<user>@<mac-ip>
DIR='<dashboardDir from config.json>'

ssh "$MAC" "rm -rf '$DIR.previous' && cp -a '$DIR' '$DIR.previous'"
rsync -a --delete dashboard/dist/ "$MAC:$DIR/"
```

`frame-bridge` needs no restart. If `dashboardDir` has spaces in it, how `rsync` handles them depends
on its version. rsync 3.2.4 and later take the path as written above. The `rsync` built into macOS
(openrsync) needs each space in the remote path escaped as `\ `.

The first `ssh` to the Mac mini asks you to accept its host key. Do that in a terminal first
(`ssh "$MAC" true`), because a non-interactive shell, such as `!` in Claude Code, fails with
`Host key verification failed`.

**4. Check it.**

```sh
curl -s -o /dev/null -w '%{http_code}\n' http://<mac-ip>:8787/                       # 401
curl -s -o /dev/null -w '%{http_code}\n' -b 'frame_token=<token>' http://<mac-ip>:8787/   # 200
curl -s -b 'frame_token=<token>' http://<mac-ip>:8787/healthz | jq .
```

Each feed in `/healthz` should be `ok`, or `error` with a `detail` you expect.

**5. Let the frame update.** It polls `/` every 15 s and reloads itself when it sees a new build, but
only once it's idle: no touch for 30 s, day mode, not on Photos, and no sheet open. To reload it now:

```sh
adb -d shell am force-stop com.wesbos.homehq
adb -d shell am start -n com.wesbos.homehq/.MainActivity
```

**Roll back.** Frames pick this up the same way.

```sh
ssh "$MAC" "rm -rf '$DIR' && mv '$DIR.previous' '$DIR'"
```

**If something's wrong:**

| Symptom | Cause |
| --- | --- |
| Dashboard files return `404` | `dashboardDir` is missing or empty |
| A frame gets `401` | Its token doesn't match any hash in the config. Issue a new one, and restart frame-bridge |
| A frame shows an error page | frame-bridge is down. See [its troubleshooting table](https://github.com/donnie-ellis/frame-bridge#troubleshooting) |
| Broken styling on the frame only | A WebView 106 problem. Rerun the checks in step 2 |

## Repo layout

| Path | What's there |
| --- | --- |
| `dashboard/src/` | New code: `lib/ui/` (touch kit), `lib/api/`, `lib/state/`, `views/` |
| `dashboard/js/`, `dashboard/css/` | Vanilla code, being converted to Svelte a view at a time |
| `dashboard/kiosk/` | The Android kiosk app, built without Gradle |
| `docs/api/` | OpenAPI contracts |
| `docs/` | Integration plans, and device notes inherited from upstream |
| `scripts/` | Inherited device tooling, for reference only |
| `.claude/` | Project rules, skills and agents, shared with Claude in GitHub Actions |

`backups/` and `diagnostics/` are gitignored. They hold flash dumps and identifiers, so never commit
or publish them.

## Automation

Issues labeled `ai-task` run through `claude --agent orchestrator`: plan, code, test, then a PR from
branch `ai/<n>`. Mentioning `@claude` on an issue or PR also works, and PRs are reviewed
automatically. None of it merges or deploys.

This is a fork with no `gh` default, so pass `--repo donnie-ellis/photo-frame-dashboard` to every
`gh` command. Otherwise it targets upstream.

## Rules we learned the hard way

These apply to any work on frame hardware.

1. **Ask the owner before every write.** Reads are fine. Writing flash, a partition, `/system`,
   or sending a RAM payload to the SoC needs explicit approval for that specific action.
2. **No writes before a verified backup**: exact byte count, SHA-256, gzip readback, a check for
   `0xCC` filler, and independent re-reads of a few partitions that match.
3. **Don't trust `OKAY`.** Fastboot reported a successful boot write on the Skylight that never
   took effect. Verify writes by reading them back and checking the result on the device.
4. **Stop at the first mismatch** in a hash, model string, offset or size. Report it rather than
   working around it.
5. **One change at a time, undo recorded first.** Keep `.bak` copies next to edited files.
6. **Pin downloads by SHA-256** from official sources (vendor archives, F-Droid, LineageOS, GitHub releases).
7. **Keep dumps private.** They contain Wi-Fi passwords, tokens, serials, MAC addresses and
   copyrighted firmware. Use the ignored `backups/` and `diagnostics/` folders. Leave unique
   identifiers out of anything you commit.
8. **Write notes as you go.** Keep a per-device file in `docs/`, with observations kept separate
   from guesses.

## Docs

**This setup**

- [apple-integration.md](docs/apple-integration.md): the frame-bridge plan, decisions and auth
- [frame-bridge.openapi.yaml](docs/api/frame-bridge.openapi.yaml): the API contract
- [pf1007l-start-here.md](docs/pf1007l-start-here.md): frame setup, with tests at each step
- [allwinner-a33-pf1007l.md](docs/allwinner-a33-pf1007l.md): what comes after root: backup, launcher,
  WebView, kiosk, memory
- [aimor-remote-root-shell.md](docs/aimor-remote-root-shell.md): the vendor app's root shell, and how
  to shut it off

**PF1007L root routes**, if a unit doesn't come with ADB

- [allwinner-a33-mainline-uboot.md](docs/allwinner-a33-mainline-uboot.md): over USB
- [allwinner-a33-sdcard-adb-wifi.md](docs/allwinner-a33-sdcard-adb-wifi.md): from the SD card only
- [allwinner-a33-boot-access.md](docs/allwinner-a33-boot-access.md): how the first unit was rooted

Everything else in `docs/` is research inherited from upstream on other hardware (the Rockchip
BIUFRAME and the Skylight). It doesn't apply to this frame.

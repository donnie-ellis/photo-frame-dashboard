---
name: deploy-dashboard
description: Build the dashboard and copy it to the Mac mini, where frame-bridge serves it to the frames on the LAN. Only when the user explicitly invokes it.
disable-model-invocation: true
---

# Deploy the dashboard

frame-bridge on the Mac mini serves the built dashboard to every frame (`docs/apple-integration.md`,
"Serving the dashboard"). Deploying means copying `dashboard/dist/` into the directory it serves.
Every step that changes something needs the user's go-ahead in this conversation.

## 1. Pre-flight (read only)

```sh
cd dashboard
git status --short                     # uncommitted changes? say so
git log --oneline origin/main..HEAD    # deploying something not on main? say so
```

Get the Mac mini's address, login user and the directory frame-bridge serves (`dashboardDir`) from
your memory, or ask the user. Confirm them with the user. Don't write them into the repo. The target is
frame-bridge on the Mac mini, not the frame or another Android device on the LAN.

Stop and ask if the working tree is dirty or HEAD isn't on `main`.

## 2. Verify the build

Run the `run-dashboard` skill's build and WebView 106 checks (steps 2–3). Don't deploy a build that
fails them.

## 3. Deploy (after confirmation)

Show the user the commit, the host and the directory. Claude doesn't run the copy; the user does,
keeping the current version as `<dir>.previous` for rollback. Quote the paths, since they may
contain spaces. macOS's built-in `rsync` (openrsync) needs spaces in the remote path escaped with
`\ `:

```
! ssh <user>@<mac-ip> 'd="<dir>"; rm -rf "$d.previous" && cp -a "$d" "$d.previous"' && rsync -a --delete dashboard/dist/ '<user>@<mac-ip>:<dir with spaces escaped>/'
```

`!` can't answer prompts. If SSH fails with `Host key verification failed`, the Mac mini's key isn't
saved yet: have the user accept it in a terminal, or run
`! ssh -o StrictHostKeyChecking=accept-new <user>@<mac-ip> true`, then rerun the copy.

## 4. Check it

- `curl -s -o /dev/null -w '%{http_code}' -b 'frame_token=<token>' http://<mac-ip>:8787/` returns
  200, and `/healthz` answers. Without the cookie, both return 401.
- Without the token you can still check the copy over SSH: the `index.html` in `<dir>` references
  the same `assets/index-*.js` and `.css` as the local `dist/`, and `<dir>.previous` exists.
- Frames reload themselves once idle (the dashboard polls `/` every 15 s; see the README's
  Deploy section). Tell the user, and say it wasn't checked on the frame.
- Report the deployed commit.

## Rollback

The user runs:

```
! ssh <mac> 'rm -rf <dir> && mv <dir>.previous <dir>'
```

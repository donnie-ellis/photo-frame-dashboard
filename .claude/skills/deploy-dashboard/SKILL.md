---
name: deploy-dashboard
description: Build the dashboard and copy it to the Mac mini, where frame-bridge serves it to the frames on the LAN. Only when the user explicitly invokes it.
disable-model-invocation: true
---

# Deploy the dashboard

frame-bridge on the Mac mini serves the built dashboard to every frame (`docs/apple-integration.md`,
"Serving the dashboard"). Deploying means copying `dashboard/dist/` into the directory it serves.
Every step that changes something needs the user's go-ahead in this conversation.

Until frame-bridge serves static files (phase 1), there is nothing to deploy to. Say so and stop.

## 1. Pre-flight (read only)

```sh
cd dashboard
git status --short                     # uncommitted changes? say so
git log --oneline origin/main..HEAD    # deploying something not on main? say so
```

Ask the user for the Mac mini's address and the directory frame-bridge serves, if they haven't given
them in this conversation. Don't write them into the repo.

Stop and ask if the working tree is dirty or HEAD isn't on `main`.

## 2. Verify the build

Run the `run-dashboard` skill's build and WebView 106 checks (steps 2–3). Don't deploy a build that
fails them.

## 3. Deploy (after confirmation)

Show the user the commit, the host and the directory. Claude doesn't run the copy; the user does,
keeping the current version as `<dir>.previous` for rollback:

```
! ssh <mac> 'rm -rf <dir>.previous && cp -a <dir> <dir>.previous' && rsync -a --delete dashboard/dist/ <mac>:<dir>/
```

## 4. Check it

- `curl -s -o /dev/null -w '%{http_code}' -b 'frame_token=<token>' http://<mac-ip>:8787/` returns
  200, and `/healthz` answers. Without the cookie, both return 401.
- The kiosk app only shows the new version after a reload. Tell the user to reload the frames.
- Report the deployed commit.

## Rollback

The user runs:

```
! ssh <mac> 'rm -rf <dir> && mv <dir>.previous <dir>'
```

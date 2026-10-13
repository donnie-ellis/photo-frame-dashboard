---
name: deploy-dashboard
description: Build and deploy the dashboard to Cloudflare Workers with wrangler. Only when the user explicitly invokes it.
disable-model-invocation: true
---

# Deploy the dashboard

This publishes to the internet and the frame picks it up. Every step that changes something
needs the user's go-ahead in this conversation.

## 1. Pre-flight (read only)

```sh
cd dashboard
git status --short                 # uncommitted changes? say so
git log --oneline origin/main..HEAD   # deploying something not on main? say so
npx wrangler whoami                # which Cloudflare account
grep -n '"name"' wrangler.jsonc    # which Worker
```

Stop and ask if:
- `wrangler whoami` isn't logged in. The user runs `! npx wrangler login` themselves.
- The Worker `name` is still `home-dashboard` from upstream and the user hasn't confirmed it's the
  name they want on their account.
- The working tree is dirty, or HEAD isn't on `main`.

## 2. Verify the build

Run the `run-dashboard` skill's build and WebView 106 checks (steps 2–3). Don't deploy a build that
fails them.

## 3. Deploy (after confirmation)

Show the user the account, the Worker name, and the commit. `.claude/settings.json` denies
`npm run deploy` and `wrangler deploy` to Claude on purpose, so the user runs it:

```
! cd dashboard && PATH=/usr/local/bin:$PATH npm run deploy
```

## 4. Check it

- Open the deployed URL that wrangler prints. Check it loads and the console is clean.
- If the dashboard uses the `/api` proxy, check that `/healthz` answers through the Worker.
- The frame reloads on its own if the bundle fails to load (`index.html`). The kiosk app only
  shows the new version after a reload. Tell the user if they need to reload the frame.
- Report the URL and the deployed commit.

## Rollback

`npx wrangler deployments list` (read only) to find the deployment. The user runs
`! cd dashboard && npx wrangler rollback <deployment-id>` themselves (it's denied to Claude).

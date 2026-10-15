---
name: tester-lockfile-drift
description: npm/npx steps in coder/tester runs often modify dashboard/package-lock.json; the user wants that drift discarded, not shipped
metadata:
  type: feedback
---

npm/npx steps (gen:api, Redocly, Prism, sometimes `npm install`) often leave `dashboard/package-lock.json` modified with re-resolved dep versions (e.g. @cloudflare/workerd) unrelated to the issue. First seen on #30 (2026-10-14). The user said to discard it and restart the loop.

**Why:** it's a side effect of verification, not part of the change, and must never go into a PR.

**How to apply:** since #31, coder and tester prompts tell the agent to restore it with `git checkout -- dashboard/package-lock.json` if npm changes it, never commit it, and leave the tree clean. This worked on #31, #32 and #41 (the tester restored it once on #41). Still run `git status --porcelain` before Ship. Anything else unexpected in the tree means stopping and reporting.

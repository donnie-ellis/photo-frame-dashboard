---
name: tester-lockfile-drift
description: Tester npm/npx steps can leave dashboard/package-lock.json modified; the user wants that drift discarded, not shipped
metadata:
  type: feedback
---

During the tester run for #30 (2026-10-14), `dashboard/package-lock.json` was left modified: re-resolved dep versions, such as @cloudflare/workerd, unrelated to the issue. The cause was probably `npx`/`npm` during gen:api, Redocly or Prism, but that wasn't confirmed. I stopped the loop as the rules require. The user said to discard the lockfile and restart.

**Why:** the drift is a side effect of verification, not part of the change, and must not go into the PR.

**How to apply:** after the tester returns, run `git status --porcelain`. If the only change is `dashboard/package-lock.json` and it isn't in the commit, still stop and report it: the rules forbid discarding on my own. Mention that the user has approved discarding it before. Consider telling the tester not to leave lockfile changes behind.

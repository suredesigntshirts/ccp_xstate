# Waiting for the person

One line each: what, why, which item waits. Threads add to this; the person clears it.

- Pick the product repo for the first real issue (plan item first-real-issue). Stage s4 waits; s0-s3 run without it.
- Protect `main`: require the `ci / test` and `verdict / gates` checks before merge (repo settings). Until then the
  gates are red marks threads respect, not a lock (plan item repo-skeleton).
- Thread branches are named `claude/...` by the environment, so threads can't follow CLAUDE.md's `<kind>/<item-id>`
  branch rule; they name the item in the PR body instead. Change the environment if you want the branch rule kept
  (plan item repo-skeleton).
- Should the v2 plugin's SessionStart hook also write the repo's settings into `~/.claude/settings.json` (taking effect from the next resume), or only check and report? A thread can't do it for itself: tried 11:34Z, refused [Self-Modification]. Until you choose, setup-script/env-bootstrap build the check only (plan/research/platform-baseline.md, "Setup script vs SessionStart").

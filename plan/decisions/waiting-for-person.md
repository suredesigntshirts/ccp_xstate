# Waiting for the person

One line each: what, why, which item waits. Threads add to this; the person clears it.

- Pick the product repo for the first real issue (plan item first-real-issue). Stage s4 waits; s0-s3 run without it.
- Protect `main`: require the `ci / test` and `verdict / gates` checks before merge (repo settings). Until then the
  gates are red marks threads respect, not a lock (plan item repo-skeleton).
- Optional: add an `ANTHROPIC_API_KEY` repo secret if you want the clean-room job to start a real headless `claude -p`
  session. Without it the job runs the plugin's hooks with no model, which tests the install the same way
  (plan item clean-room-install-test; `2026-10-30-clean-room-hooks-without-model.md`).
- Thread branches are named `claude/...` by the environment, so threads can't follow CLAUDE.md's `<kind>/<item-id>`
  branch rule; they name the item in the PR body instead. Change the environment if you want the branch rule kept
  (plan item repo-skeleton).
- Should the v2 plugin's SessionStart hook also write the repo's settings into `~/.claude/settings.json` (taking effect from the next resume), or only check and report? A thread can't do it for itself: tried 11:34Z, refused [Self-Modification]. Until you choose, setup-script/env-bootstrap build the check only (plan/research/platform-baseline.md, "Setup script vs SessionStart").
- Mods a thread writes load only after you answer "Turn on the mods Claude writes in this session?" in that session. So engine-host ships as an installed plugin (plan/decisions/2026-10-30-setup-script-vs-sessionstart.md); installing it to the account is yours when engine-host is ready.

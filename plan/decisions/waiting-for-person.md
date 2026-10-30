# Waiting for the person

One line each: what, why, which item waits. Threads add to this; the person clears it.

- Pick the product repo for the first real issue (plan item first-real-issue). Stage s4 waits; s0-s3 run without it.
- Protect `main`: require the `ci / test` and `verdict / gates` checks before merge (repo settings). Until then the
  gates are red marks threads respect, not a lock (plan item repo-skeleton).
- Thread branches are named `claude/...` by the environment, so threads can't follow CLAUDE.md's `<kind>/<item-id>`
  branch rule; they name the item in the PR body instead. Change the environment if you want the branch rule kept
  (plan item repo-skeleton).
- Rebuild the v2 cloud environment (re-save the setup script). The probe thread's container started from a cache and skipped it ("Skipping initialization script for faster startup"), so `~/.claude/settings.json` was never written: no allow rules, subagent depth 1. probe-platform-baseline's rule-dependent rows wait on a rerun after that (plan/research/platform-baseline.md).
- Open https://claude.ai/artifact/YUMK21WxirbJgGCE7ppaQj once and allow file access: it records whether a page can read a Library JSONL (probe-platform-baseline, row page-reads-journal).
- To test a mod inside a live thread, answer "Turn on the mods" in a probe thread, or install probes/platform as a plugin; only the person can switch it on (probe-platform-baseline rows idle-spawn-mod, mcp-from-mod).

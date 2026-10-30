# Waiting for the person

One line each: what, why, which item waits. Threads add to this; the person clears it.

- Pick the product repo for the first real issue (plan item first-real-issue). Stage s4 waits; s0-s3 run without it.
- Protect `main`: require the `ci / test` and `verdict / gates` checks before merge (repo settings). Until then the
  gates are red marks threads respect, not a lock (plan item repo-skeleton).
- Thread branches are named `claude/...` by the environment, so threads can't follow CLAUDE.md's `<kind>/<item-id>`
  branch rule; they name the item in the PR body instead. Change the environment if you want the branch rule kept
  (plan item repo-skeleton).
- The setup sitting, in one go once env-bootstrap merges: paste `infra/cloud-environment/paste-me.sh` into the
  project's environment setup script, save, and start one fresh thread so it rebuilds. That paste places the full
  v2 allow-rule set from probe-platform-baseline. Pick the product repo in the same sitting (plan items
  person-setup-sitting, env-bootstrap; see `person-setup-sitting.md` here).
- wf-quick-fix's `replays-110` line needs a journal from PR #110's real run, and none is committed in ccp_machine.
  Making one means running ccp_machine's code (`node packages/orchestrator/bin/orchestrator.js demo`, or its sandbox
  host), and auto mode refused that twice as "code from external". Either allow running ccp_machine code in this
  environment, or commit a recorded `journal.jsonl` from #110's headless run to ccp_machine. The PR stays open until
  a verifier replays it (plan item wf-quick-fix).

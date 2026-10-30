# The toy run

Plan item engine-toy-run: a toy issue in the scratch repo taken from filed to merged by quick-fix on the engine, with
real actors. How it is run: `scripts/toy-run.sh` (its header) and `plan/decisions/2026-10-30-engine-toy-run.md`.

## What ran (toy-2, 2026-10-30)

| | |
|---|---|
| Issue | suredesigntshirts/ccp_xstate_scratch#23, "Toy (toy-2): add sub_toy_2(a, b)" |
| Driver | headless `claude -p` (Sonnet, Claude Code 2.1.314), session `869e83a4-9b1d-4453-b963-dbdd5a9ed1c6` |
| Journal | `/mnt/project-files/toy-run/harness/journal`, item file `items/toy-2.jsonl` |
| PR | suredesigntshirts/ccp_xstate_scratch#24, branch `run/toy-2/1.build`, head `a8ebb229390d08ebcf4839a20828f4fca5b49d07`, CI `test` green |
| Merge card | `cmsg_01VhYV3jhQ9s4qrrh2th12sN4nfPSXTJRtCVFMTVXCY6iu`, posted 21:34Z by this thread |

The item's transitions, with the source of each (`scripts/toy-run.sh check toy-2`):

| seq | event | source | kind | at |
|---|---|---|---|---|
| 0 | `xstate.init` | `claude-code` the driver session | filing (the session's own act) | 21:30:30 |
| 1 | `xstate.done.actor.brief` | `harness` return `toolu_015u7…` | completion, checked by the return hook | 21:30:46 |
| 2 | `xstate.done.actor.build` | `harness` return `toolu_017nu…` | completion; PR #24 read from GitHub at the claimed head | 21:32:41 |
| 3 | `xstate.done.actor.verify` | `harness` return `toolu_01PrR…` | completion | 21:33:08 |

The driver typed nothing but `ccp-run <run>` for each agent; the hook swapped in the brief, the agent returned through
the return tool, and the hook handed the result to the item, which prepared the next run.

## The numbers

- Filed to awaitingMerge: 2 min 38 s (21:30:30 to 21:33:08). Brief 12 s, build 1 min 42 s (agent start to accepted
  return), verify 20 s. Driver's gaps between a result and the next Agent call: 7 to 13 s.
- Tokens (from the transcripts, by agent): driver 1.2k output, 271k cache read; brief, build and verify agents
  1.8k to 2.1k output each, 107k to 166k cache read each. About 7k output tokens for the whole run.
- Journal check on the driver session (`--events` its transcript and subagents): 21 tool calls in the event log, 21
  `tool.call` rows, 0 missing, 0 unexplained.

## Surprising

- **The first run wasn't captured.** toy-1's journal had no `sessions/` folder; the install makes it and capture's
  `append` doesn't, so capture failed silently on every call (and the driver's session-start check said so). The
  actor hooks write their own folders, so the run itself went fine. Fixed in the script; toy-1 withdrawn.
- **The brief actor's default brief is enough.** quick-fix's brief actor gets only "do what the brief step asks" and
  the issue; it read the issue and wrote briefs that named the function, the test file, the `Closes` line and the CI
  check. The verifier brief told it to use `gh pr checks`, which needs GraphQL; the verify agent fell back to REST
  itself.
- **The workflow's only person step is a real wait.** Everything up to the card took under three minutes; the card
  waits for a person's tap, and no session can make that wake. A toy run is as fast as the person.
- **A pgrep for the script matched its own wait loop**, so a 2-minute run looked like a 10-minute one from outside.
  Waiting on the item file instead is exact.

## Still open

- The merge: waits for the tap on the card above (waiting-for-person.md). When it comes, `scripts/toy-run.sh tap toy-2
  <wake file>` hands it to the driver, and this page gets the merge's numbers.
- This thread's own calls (posting the card, running `toy-run.sh`) aren't journalled: it runs the 0.1.0 snapshot.
  The driver's are.

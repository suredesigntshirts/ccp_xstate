# Real-model run "blocked-retry": a refused push, the blocked card, a cleared block and a retried build

Plan item `fix-blocked-retry`, Expect line **real-run-captured** (plan/decisions/2026-11-05-blocked-retry.md).

- **Engine and workflow:** this checkout's `packages/engine/` and `workflows/quick-fix.json` at the build commit
  679f4da (branch `build/fix-blocked-retry`). Its base includes fix-rebuild-worktree (b62d5b3). The journal's first
  row pins `quick-fix@6a0b9dfd27e783ce29b1cb1e9a911c57862760f7586d2638ce672ae50d9e9d8d`, the PR's quick-fix.
- **World:** the trial-fail-path blocked world (`../blocked/`), copied to `driver/`. It has a local bare origin
  whose pre-receive hook refuses any push that changes `.github/workflows/`, using GitHub's text for a token without
  the `workflow` scope. GitHub is the tourney fake (an HTTP server on 127.0.0.1), and CI is `npm test` at the PR head.
  The issue is #12: run CI on Node 22 as well as Node 20. Nothing left the machine.
- **Agents:** each model run was a real Claude agent (sonnet), started the way a thread starts one: a headless
  `claude -p --plugin-dir plugins/harness` session called the Agent tool with `ccp-run <run>`. The harness's own
  hooks did the rest. They swapped in the brief, bound the agent (`agent.json`), kept it in its worktree and accepted
  its `return` tool call. Capture wrote `journal/sessions/` rows. `CCP_HARNESS_DIR` was this folder and
  `CCP_GITHUB_API` the fake GitHub. Unlike the earlier trials, the agents got no trial note and returned through the
  real return tool.
- **Person's part:** this thread acted as stand-in. `drive.mjs clear` removed the pre-receive hook, which stands in
  for granting the scope. `drive.mjs tap retry` answered the blocked card through a tap wake. The CI-change card was
  tapped "approve CI change".

`driver/run-all.sh` repeats the whole run from a fresh world.

## Outcome

The item went brief → build **blocked** → card **blocked** (retry, replan, drop) → clear + **retry** → build → CI
green → verify **PASS** → CI-change card → **merge** → `done`. The transitions are in `journal/items/trial.jsonl`:

| seq | event | to | source |
|---|---|---|---|
| 0 | xstate.init | briefing | claude-code |
| 1 | xstate.done.actor.brief | building | harness (return) |
| 2 | xstate.error.actor.build, with `blocked` | blocked | harness (return) |
| 3 | xstate.done.actor.ask (`retry`) | building | hearth (tap) |
| 4 | xstate.done.actor.build | checking | harness (return) |
| 5 | github.check_suite.completed | verifying | github |
| 6 | xstate.done.actor.verify (PASS) | awaitingGates | harness (return) |
| 7 | xstate.done.actor.ask (approve CI change) | merging | hearth (tap) |
| 8 | xstate.done.actor.merge | done | engine |

- **1.build** (`a881402ae55225be1`) committed the matrix change (4601e05), and its push was refused twice. The refusals
  are in `run/refused-pushes.jsonl`. It returned `{ blocked: { reason } }`, naming the refusal text, the local commit
  and the fix: "a push credential with the `workflow` scope (or the person pushing/approving the workflow change);
  then retry the build". The error event carries `error: "build blocked: …"` as on main, and also `blocked: <reason>`.
  `blockedBuild` held (`built` null), so the item went to `blocked`.
- **The card** (run 2.ask) asked "The build is blocked; what stopped it is below. Clear the block, then retry the
  build with the same briefs; or replan it with a written five whys; or drop it?" with choices `retry`, `replan`,
  `drop` and `failure` set to the block's text. `run/driver-log.jsonl` has `block.cleared`, then `person.tap` with
  choice `retry` and who chose it.
- **3.build** (`a184fbab1f9acfa9c`) got the same builder brief as 1.build. No brief run happened between them. Its
  `run.json` input has `failure` = the block's text. Its push went through and it opened PR #1 at d2aadd7. Its stamped
  `gates` list `.github/workflows/test.yml`, so the item asked for the CI-change approval before merging.
- **5.verify** (`adc9f58e1f22c14a2`) returned PASS on both Expect lines at d2aadd7. The host merged at that sha
  (`run/gh-state.json`: `merges`).

## Live capture

Each model run's agent is bound in its `agent.json` and has its own session file under `journal/sessions/` (one
headless session per run). Each agent's rows include `agent.spawn`, `brief.stored`, its `tool.call` rows,
`agent.finish` and `result.stored`:

| Run | Agent | tool calls | agent.finish ms | output tokens | cache read |
|---|---|---|---|---|---|
| 0.brief | a8354f6799cae4c65 | 3 | 13173 | 1394 | 66115 |
| 1.build | a881402ae55225be1 | 7 | 38501 | 2352 | 176920 |
| 3.build | a184fbab1f9acfa9c | 7 | 40312 | 1960 | 176425 |
| 5.verify | adc9f58e1f22c14a2 | 5 | 25252 | 1847 | 152222 |

`node scripts/inspector/build.mjs` over this source (scripts/inspector/sources.json, "Blocked build, cleared and
retried, 5 Nov") replays the journal on this checkout with no mismatch. It shows all four model steps with a trace
(7, 12, 12 and 11 rows), ms and tokens.

## Seen on the way, not this item's

- Each agent called `return` and then ended with a `SubagentHandback`. For both builds and the verify agent, the hook
  refused that handback as `no-return` (one `refusal` row each), even though their results had already been
  accepted. Nothing changed because of it. It looks like the handback check doesn't see a result accepted earlier in
  the same turn. It is worth a look in the done replan.
- The verify agent's first `return` was refused `unknown-run`; its second, with the right run id, was accepted.
- The blocked card has no PR, so the stand-in grant path (`bin/host.js answer`) cannot answer it: a grant names
  repos, and `repoOf` reads the card's `pr`. The retry here went through the tap path.
- A first attempt at this run stopped at the CI-change card, because the driver's platform stand-in numbered cards
  from 1 in each process and both cards got `cmsg_card1`. The driver now names a card by its effect key, and the run
  was repeated from a fresh world. Only the repeat is committed.

## Files

- `journal/`: the item's journal, its runs, blobs and `sessions/` capture; `install.json` is the harness marker.
- `run/`: `driver-log.jsonl`, `gh-state.json`, `refused-pushes.jsonl`, `shim-calls.jsonl`, `ci/` logs, and
  `sessions/` (each headless driver session's JSON result).
- `driver/`: `drive.mjs`, `run-all.sh`, the `gh` stand-in and `lastmsg.mjs`.

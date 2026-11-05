# Real-model trial "fail": verify FAIL, a rebuild with the verdict, then PASS and merge

Plan item `trial-fail-path`, Expect line **fail-loop**. The trial ran main's engine (`packages/engine/`) at 2741445
(main after replan #91), on quick-fix, with the adopt trial's driver.

- Driver: `driver/drive.mjs`, the adopt driver with a new issue (#31, `percent()`), a seed README that already
  documents every export (so no other half-met line exists), and one added command, `inject`. Fake GitHub, local bare
  origin, real `npm test` as CI, as in adopt. The `gh` wrapper was on PATH at `/root/.local/bin/gh` only during the
  trial and has been removed.
- **Build 1 was injected, not a model** (plan/decisions/2026-11-05-trial-fail-path.md). `node drive.mjs inject` wrote
  `percent()` with rounding, a README entry and a rounding test, but no RangeError for whole 0. It pushed the run's
  branch, opened PR #1 through the shim and answered the run. Its diff is `run/injected.diff`, its answer
  `run/answers/trial_1.build.injected.json`. It misses exactly expect line 2, "percent(part, whole) throws a
  RangeError when whole is 0"; `npm test` still passes, so CI was green.
- Every other run was a real model agent. Each was told only: "Your prompt is the file `<run/pending/…prompt.md>`,
  word for word: read it and do what it says. Trial note: the harness return tool here is wired to another journal, so
  do not call it; instead your final message must be only the result JSON (the value you would pass as result)." Each
  pending prompt equals the run's `brief.md` + blank line + `context.md` byte for byte. Raw answers are in
  `run/answers/`.

## Outcome

Merged on the second build, with 0 refusals of any rule.

brief → build 1 (injected) → CI green at `8b25414` → **verify FAIL** (line 2) → build 2 → CI green at `06d7cc8` →
**verify PASS** (4/4) → card tapped approve → merged at `06d7cc8` → item `done`.

| Run | Who | First return valid? | Refusals by rule |
|---|---|---|---|
| `trial:0.brief` | model | yes | none |
| `trial:1.build` | injected | yes | none |
| `trial:3.verify` | model | yes | none |
| `trial:4.build` | model | yes | none |
| `trial:6.verify` | model | yes | none |

| Rule | Count |
|---|---|
| schema | 0 |
| restated | 0 |
| covers | 0 |
| ref | 0 |
| reserved, unknown-run, wrong-caller, already-returned, already-failed | 0 |

The journal has no `refusal` row, and `run/driver-log.jsonl` has no refused or unparsable answer.

## Did the prompts carry the agents without coaching?

Yes. No agent was told anything beyond its prompt and the trial note, and none was sent back.

### 0.brief
- One check per expect line, in order, each a runnable `node -e` with PASS and FAIL conditions. Check 2 calls
  `percent(5,0)`, `percent(0,0)` and `percent(-3,0)` and FAILs on a returned value. Stricter points sit under Advisory.
- The builder brief asked for the RangeError explicitly. That did not matter here, since build 1 was injected.

### 3.verify (the FAIL)
- Ran each check at `8b25414`. Line 2 FAIL with the evidence "percent(5,0) returned Infinity, percent(0,0) returned
  NaN and percent(-3,0) returned -Infinity". Lines 1, 3 and 4 PASS. It noted under evidence that the README does not
  mention the RangeError and no test covers it.
- Its `issue` echoed only `url` and `expect`, and was accepted: fix-verify-issue-echo holds (adopt's `restated`
  refusal did not recur).
- The engine took `failed` and went back to `building` with `context.verdict` set.

### 4.build (the rebuild)
- Its `stage.json` shows input `verdict` from `context.verdict`, equal to 3.verify's accepted result, and `previous`
  as PR #1 at `8b25414`.
- **Friction: the rebuild's worktree starts on a new branch at main.** The run line names branch
  `run/trial/4.build` at main's head, while `previous` says to push to PR #1's branch. The agent reconciled it itself
  (`git fetch`, `git reset --hard origin/run/trial/1.build`, fix, `git push origin HEAD:run/trial/1.build`) and said so
  in `notes`. The rule "Use no other branch name" and "when previous is set, push to that PR" point two ways, and the
  worktree does not hold the code being fixed. This worked, but a weaker agent could open a second PR or rebuild from
  scratch. Candidate draft item: prepare a rebuild's worktree on the previous PR's branch at its head.
- It fixed only the FAIL line (`whole === 0` throws `RangeError`), added tests for it and noted the README now
  mentions it. 7 tool calls.

### 6.verify (the PASS)
- Fetched `pull/1/head`, checked out `06d7cc8` detached, and ran the same four checks. All PASS.

### Ask and merge
- awaitingMerge posted one card with the PR at `06d7cc8` (`green: true`) and the PASS verdict. The driver tapped
  approve and the fake GitHub shows PR #1 merged at `06d7cc8`.

## N3 recurred, with a new trace

Build 2's commit carries this session's `Co-Authored-By` and `Claude-Session` trailers, and an `Item:` line pointing
at the issue. That line is this repo's PR convention (CLAUDE.md), not anything in the stage prompt. The ambient
instructions reach the agents, as in trial 2 and adopt.

## Stage record

Every run has `runs/<n>.<actor>/stage.json`. Its `prompt.parts` reassemble with `assemble()` to `brief.md` byte for
byte, and `prompt.hash` is the sha256 of `brief.md`, for all five runs.

## Files

- `journal/`: the item's journal, its runs (`brief.md`, `context.md`, `run.json`, `stage.json`, `result.json`) and
  blobs.
- `run/`: `driver-log.jsonl`, `shim-calls.jsonl`, `gh-state.json`, `ci/` (both CI logs), `pending/` (the exact
  prompts), `answers/` (the raw returns, including the injected one), `injected.diff`.
- `driver/`: the driver, the `gh` shim and wrapper, and `lastmsg.mjs`.

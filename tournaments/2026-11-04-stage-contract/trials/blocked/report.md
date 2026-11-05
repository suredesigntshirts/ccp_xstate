# Real-model trial "blocked": a refused push, a blocked build, and replanning

Plan item `trial-fail-path`, Expect line **blocked-route**. The trial ran main's engine (`packages/engine/`) at
2741445 on quick-fix, with the adopt trial's driver.

- Driver: `driver/drive.mjs`, the adopt driver with a new issue (#12, run CI on Node 22 as well), a seed repo with
  `.github/workflows/test.yml`, and a `pre-receive` hook on the local origin. The hook refuses any push that changes a
  file under `.github/workflows/` with GitHub's own text for a token without the `workflow` scope
  (plan/decisions/2026-11-05-trial-fail-path.md). The shim's `gh auth status` reports `Token scopes: 'repo'`.
- Both runs were real model agents. Each was told only: "Your prompt is the file `<run/pending/…prompt.md>`, word for
  word: read it and do what it says. Trial note: the harness return tool here is wired to another journal, so do not
  call it; instead your final message must be only the result JSON (the value you would pass as result)." Each
  pending prompt equals the run's `brief.md` + blank line + `context.md` byte for byte.

## Outcome

The build returned `blocked`, the item stopped at `replanning`, and the card carries the reason. There were 0 refusals.

brief → **build blocked** (push refused) → `replanning`: ask card `cmsg_card1`, "This item stalled. Replan it with a
written five whys, or drop it?", with `failure` = "build blocked: The push was refused, so no PR could be opened. …".

| Run | First return valid? | Refusals by rule |
|---|---|---|
| `trial:0.brief` | yes | none |
| `trial:1.build` | yes (`blocked`) | none |

| Rule | Count |
|---|---|
| schema | 0 |
| restated | 0 |
| covers | 0 |
| ref | 0 |
| reserved, unknown-run, wrong-caller, already-returned, already-failed | 0 |

The journal has no `refusal` row, and `run/driver-log.jsonl` has no refused or unparsable answer. (Its one line
containing "refused" is the reason text inside `item.asks`.)

## Did the prompts carry the agents without coaching?

Yes. Neither agent got anything beyond its prompt and the trial note.

### 0.brief
- The builder brief gave the exact matrix change. The verifier brief parsed the YAML and checked
  `strategy.matrix.node-version` and setup-node's `${{ matrix.node-version }}`. The brief writer could not see the
  refusal, which only a push meets, so the trap reached the builder as designed.

### 1.build
- In 5 tool calls: read the prompt, read the workflow, wrote the matrix, checked the YAML parses, committed, pushed,
  and ran `gh auth status`. The push output it saw is in `run/builder-push.txt`:
  `remote: refusing to allow an OAuth App to create or update workflow `.github/workflows/test.yml` without `workflow` scope`
  and `! [remote rejected] run/trial/1.build -> run/trial/1.build (pre-receive hook declined)`.
- It tried no workaround: no second push, no PR without the workflow change, and no attempt to write the file through
  another route. It returned `{ blocked: { reason } }`, naming the commit, the refused file, the refusal text and the
  token's `repo`-only scope, and said what would unblock it: the person grants the scope or pushes the commit. This is
  the build rule "If you cannot push or open the PR (… access refused …), return blocked", followed as written.
- The origin's own record of the refusal is `run/refused-pushes.jsonl` (one row, sha `c7908f4`).

### Replanning
- The engine took the blocked result as the build's error ("build blocked: <reason>"), set `failure`, and moved to
  `replanning`. Its ask card's input has `verdict: null` and that `failure`, and its one-hour checkBack timer is set.
  The trial stops there: replanning is the person's decision.

## Stage record

Both runs have `runs/<n>.<actor>/stage.json`. Its `prompt.parts` reassemble with `assemble()` to `brief.md` byte for
byte, and `prompt.hash` is the sha256 of `brief.md`.

## Files

- `journal/`: the item's journal, its runs and blobs.
- `run/`: `driver-log.jsonl`, `shim-calls.jsonl`, `gh-state.json` (no PR was opened), `pending/`, `answers/`,
  `refused-pushes.jsonl`, `builder-push.txt` (the push command and output, from the agent's transcript).
- `driver/`: the driver, the `gh` shim and wrapper, and `lastmsg.mjs`.

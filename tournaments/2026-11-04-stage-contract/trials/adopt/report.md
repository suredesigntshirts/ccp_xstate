# Real-model trial "adopt": quick-fix on the adopted stage contract

Plan item `engine-stage-contract`, Expect line **trial**. The trial ran this repository's engine
(`packages/engine/`) on the branch `build/engine-stage-contract`. The engine code is the same as the PR head. The commits
after the trial add only this folder.

- Driver: `driver/drive.mjs`. It is trial 2's driver
  (`/mnt/project-files/stage-contract-tournament/trial2/driver/`), re-pointed at this checkout's engine. It uses the
  same fake GitHub, local bare origin and `gh` shim.
- Method: the same as trial 2, with no coaching. Each agent got exactly the prompt (`brief.md` + `context.md`), plus
  a one-line trial note: the return tool here is wired to another root, so its final message must be the result JSON.
  The driver passed that JSON to `accept()`. Every prompt is in `run/pending/` and every raw answer is in
  `run/answers/`.
- The `gh` wrapper was on PATH at `/root/.local/bin/gh` only during the trial and has been removed. The shim made no
  network calls. All of its calls are in `run/shim-calls.jsonl`.

## Outcome

Merged on the first build, with 0 schema refusals and 1 contract refusal (`restated`).

- Flow: brief, then build, then CI (real `npm test`, green at `763afc8`), then verify PASS (4/4), then the card was
  tapped approve and the PR merged.
- Agent runs: 3. One verify return was refused, sent back once and accepted.

| Run | First return valid? | Refusals by rule |
|---|---|---|
| `trial:0.brief` | yes | none |
| `trial:1.build` | yes | none |
| `trial:3.verify` | no | `restated` ×1, then accepted |

| Rule | Count |
|---|---|
| schema | 0 |
| restated | 1 |
| covers | 0 |
| ref | 0 |
| reserved, unknown-run, wrong-caller, already-returned, already-failed | 0 |

One more row in `run/driver-log.jsonl`, `answer.unparsable` for `trial:0.brief`, is a driver fault, not a refusal.
My first extraction read the agent's last text block, but the agent had returned through its hand-back message, so
the driver saw an empty answer. That row never reached `accept()`. The same answer, extracted properly by
`driver/lastmsg.mjs`, was accepted on the first try.

## The half-met trap

Issue #23 asks for `clamp`. Its third line, "README.md documents every function math.js exports", is half-met by a
build that documents only `clamp`: the seed repo exports `subtract`, which the README never documented. The body asks
only for clamp's docs.

The trap did not spring, because the **brief writer** caught it. It read the repo, told the builder to add a
`### subtract(a, b)` entry, and wrote the verifier's check 3 to FAIL if subtract is missing. So the FAIL path, verify
FAIL followed by a rebuild, was not exercised with real agents, for the third trial running. It is still covered only
by the scenarios (Q3, Q4, S5) and by parity C-second-fail-replans.

## N3 (trailers the prompt never asked for): recurred

The builder's commit ends with the orchestrating session's `Co-Authored-By` and `Claude-Session` trailers. The PR
body ends with its "Generated with Claude Code" footer and session link. No stage prompt asks for either. They come
from this host's ambient instructions to every agent. So the stage contract's assumption that "the prompt is all the
agent is told" still does not hold on this host. This is a host fact and the engine cannot fix it. If the harness
should own commit trailers, a later item must add them itself, or strip them.

## Per stage

### 0.brief
- One check per line, in order. No branch or base is named. Paths are from the root. Stricter checks (tests for
  clamp, unchanged add/subtract/multiply, NaN behaviour) are under **Advisory**.
- Defect: check 3's `node -e "…"` is inside bash double quotes, so `\\s` and `\\(` lose a backslash and the regex
  does not compile. The verifier saw the crash, said it was the brief's quoting and not the PR, reran the same script
  in single quotes and reported both runs in its evidence. Nothing in the contract caught this. A brief's commands are
  not run before they are fixed.

### 1.build
- `gh pr list`, then `gh pr create -R o/r --head run/trial/1.build` with a title and a body. The body has one bullet per
  expect line saying how it is met, which is the new build rule from trial 2's N2. Then
  `gh pr view … --json url,headRefOid`. It returned `{ pr: { url, at } }` with a full sha.
- It set no `notes`, and had no caveat to give.
- The PR changed only `README.md`, `math.js` and `test/math.test.js`.

### 3.verify
- It ran checkout first. Every line was checked by running something at `763afc8`, and the Advisory items went into
  evidence only.
- Refused once, by `restated`. Its first `issue` held only `url` and `expect`, the two keys the output Schema marks
  required, and dropped `title` and `body`, which the input had. The Output text says "copied byte for byte with the
  same keys in the same order", but the Schema's `required` list reads as permission to send less. After the refusal
  text was relayed, the second return copied all four keys and was accepted.
- This is trial 2's N5, now seen failing once. The echo of a 600-character body is the most fragile field in the verify
  output. Two possible fixes:
  - the Schema could require every key the input issue has, since the host builds it per run from `meta.input`;
  - the host could compare only `url` and `expect`.

  Either is a separate item.

### Ask and merge
- awaitingMerge posted one card, carrying the PR ref with `key`, `checkout` and `green: true` as stamped by the host,
  and the verdict. The driver tapped approve, and merge ran at `verdict.pr.at`. The fake GitHub shows the PR merged.

## Stage record

Every model run has `runs/<n>.<actor>/stage.json`, and its `prompt.parts` reassemble (`assemble()` from
`packages/engine/src/stages.js`) to that run's `brief.md` byte for byte. The recorded `prompt.hash` is the sha256 of
`brief.md`. All three runs name `quick-fix@8dc9451a…`, the workflow pinned at start, whose blob is in
`journal/blobs/`.

| Run | parts == brief.md | hash |
|---|---|---|
| 0.brief | yes | yes |
| 1.build | yes | yes |
| 3.verify | yes | yes |

## Files

- `journal/`: the item's journal, its runs (with `brief.md`, `context.md`, `run.json`, `stage.json`, `result.json`)
  and the blobs.
- `run/`:
  - `driver-log.jsonl`
  - `shim-calls.jsonl`
  - `gh-state.json` (the fake GitHub at the end)
  - `ci/` (the CI log)
  - `pending/` (the exact prompts)
  - `answers/` (the raw returns, including the refused one)
- `driver/`:
  - the driver
  - the `gh` shim and its wrapper
  - `lastmsg.mjs`, which pulls an agent's final message or hand-back from its transcript

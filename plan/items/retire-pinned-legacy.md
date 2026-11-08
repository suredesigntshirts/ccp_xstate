```json
{
  "id": "retire-pinned-legacy",
  "title": "Retire compatibility for items pinned to older workflow formats",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "The cutoff is recorded (plan/decisions/2026-11-08-retire-pinned-legacy.md): no item pinned to an older workflow format runs on this release. loadWorkflow of a pin runs the same load check as a workflow loaded by name, with no relaxation; a pinned workflow it refuses still loads for reading, marked retired with the check's message, so restore replays it and every committed journal still replays and renders. The host refuses to advance an item on a retired workflow: applyEvent turns its events away as refused, naming the pin, the check's message and the release on the item's seq-0 row to finish it on, and runEffects runs none of its effects, so no run of it starts and a result from a run an earlier release prepared goes nowhere. checkStages has no pinned option, and no engine source keeps a branch or message for workflows pinned before the stage contract or before the asking timer.",
  "why": "Each keep-old-behaviour branch is small and together they are much of the reading cost; nothing is live (research plan/research/design-books-cleanup.md, finding 7).",
  "serves": [
    "L-count-concepts"
  ],
  "depends_on": [
    "stage-contract-declares-rules"
  ],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 7: the compatibility branches (index.js's pinned load, checkStages({ pinned: true }), the pre-contract refusal, the two pin formats) and the cutoff"
    },
    {
      "ref": "plan/decisions/2026-11-08-retire-pinned-legacy.md",
      "what": "The cutoff and its evidence, reading versus running, why the unmarked reading in marks.js stays, and what is out of scope"
    },
    {
      "ref": "packages/engine/src/index.js",
      "what": "loadWorkflow's pinned branch and its checkStages call with pinned: true; workflowNames' comment on pre-contract workflows"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "checkStages' pinned option and the asking-timer loop it skips; the pre-contract refusal at the invoke check and the 'task part' hint"
    },
    {
      "ref": "packages/engine/src/host.js, packages/engine/src/actors.js",
      "what": "restore, applyEvent and runEffects; the deliver path that loads a run's workflow by its pin and offers its result"
    },
    {
      "ref": "test/journals-replay.test.mjs, tournaments/2026-11-04-stage-contract/trials/adopt/journal",
      "what": "Every committed journal replays on its pin; the adopt trial's quick-fix pin predates the asking timer and is the one committed pin the current check refuses"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/index.js",
      "what": "loadWorkflow of a pin checks the blob's hash and runs checkStages as for a name; when the check refuses, the spec is returned marked retired (stages.js retire) and re-exports retiredOf"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "retire(spec, error) and retiredOf(spec): a non-enumerable mark holding the check's message, null for a runnable spec; checkStages(spec, { workflows }) with no pinned option; every ask state's timer is checked for every workflow; the invoke refusal is 'is not a stage (it lacks ...), a host effect (...) or a workflow' with no pre-contract sentence; a stage with a task part lacks input task like any other"
    },
    {
      "ref": "packages/engine/src/host.js",
      "what": "restore keeps the release on the item's seq-0 row (startedOn); retiredText(host); applyEvent on a retired workflow returns refused with that text, inline like the host's other turned-away reasons, and changes nothing; runEffects on one runs nothing"
    },
    {
      "ref": "packages/engine/src/prompts.js, packages/engine/README.md, docs/language.md",
      "what": "prompts.js's comment on a workflow with no stage files in the present tense; the README's loading section says pins are checked as names and what retired means; retired workflow in the glossary"
    },
    {
      "ref": "packages/engine/test/retired.test.js",
      "what": "The builder's tests: the adopt trial's pin loads and replays, and applyEvent and runEffects refuse it with the release named; a pre-contract copy and a copy whose ask state has no timer, pinned in a temp root, load retired; a current pin is not retired and its item advances"
    },
    {
      "ref": "packages/engine/test/tourney/S3.test.js, packages/engine/test/tourney/P1.test.js, packages/engine/test/waits.test.js",
      "what": "The only existing assertions that change, each from a pin that throws at load to a pin that loads with retiredOf matching the same refusal: S3 (C)'s pre-contract and round-2 pins (the round-2 message is now 'stage brief lacks input task', the pre-contract one loses its pinned-before sentence) and S3 (D)'s pinned copy without covers; P1's pinned blob lacking a part; waits.test's pin without a timer, which loaded runnable and now loads retired"
    },
    {
      "ref": "plan/items/retire-unmarked-reading.md",
      "what": "A draft item: remove marks.js's unmarked reading, with the decision to update the done suites that assert it"
    }
  ],
  "expect": [
    {
      "id": "records-readable",
      "check": "At the head, every workflow blob pinned by a committed journal loads through loadWorkflow, and every committed journal replays through restore (test/journals-replay.test.mjs passes unchanged); the adopt trial's pin loads with retiredOf naming its asking state without a timer, and the stage bench's prompt-only render of the adopt trial still matches its committed prompts",
      "how": "The verifier's own test loading each committed pin and replaying each committed journal at the head; npm test covers journals-replay, verify/stage-bench and verify/trial-fail-path",
      "proof": "verifier"
    },
    {
      "id": "retired-not-run",
      "check": "Through the head's real host and hooks, an item pinned to a retired workflow (the adopt trial's pin copied into a temp root with its journal; a pre-contract quick-fix copy; a quick-fix copy whose awaitingGates has no after) is never advanced: applyEvent returns refused with a reason naming the item, its pin, the check's message and the release on its seq-0 row, and writes no applied row; runEffects starts no effect and writes no effect row; delivering a result returned from one of its committed runs (actors.js deliver) applies nothing. An item on a current pin started in the same root advances",
      "how": "The verifier's own tests driving restore, applyEvent, runEffects and deliver at the head",
      "proof": "verifier"
    },
    {
      "id": "one-check",
      "check": "At the head, checkStages takes no pinned option and no file under packages/engine/src skips a check for a pinned workflow or names workflows pinned before the stage contract or the asking timer; loadWorkflow runs the same checkStages call for a pin and a name",
      "how": "The verifier's grep of packages/engine/src for pinned, 'before the stage contract', 'before this contract', 'asking states' and the checkStages calls, and its reading of index.js and stages.js",
      "proof": "verifier"
    },
    {
      "id": "current-as-main",
      "check": "Every test that passes on main passes at the head, apart from the two test files the outputs name, changed in the ways they name, plus the builder's new tests; no other item's verify/ folder changes",
      "how": "npm test at both shas, and the verifier's reading of the test diff",
      "proof": "verifier"
    },
    {
      "id": "cutoff-recorded",
      "check": "The decision file states the cutoff and its evidence, and that evidence holds: /mnt/project-files/harness/journal has no items folder, and every item journal under the shared folder's trial roots is one the decision names as ended or dropped",
      "how": "The verifier lists the shared folder's journal roots and reads each item's last applied state",
      "proof": "world"
    },
    {
      "id": "retired-tests",
      "check": "The builder's retired tests go red when applyEvent stops refusing a retired workflow, and when runEffects runs its effects",
      "how": "The verifier breaks each and runs packages/engine/test/retired.test.js",
      "proof": "builder"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The check runs on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "retired workflow (a pinned workflow the current load check refuses: it loads for reading, and the host does not run it)"
    ],
    "merges": [
      "the load check of a pin into the load check of a name"
    ],
    "removes": [
      "the relaxed load check for pinned workflows (asking states without a timer)",
      "the refusal at load of workflows pinned before the stage contract"
    ],
    "budget": 1
  },
  "non_goals": [
    "marks.js's reading of a stage without marks stays: done suites assert it (decision file); retire-unmarked-reading removes it",
    "The inspector's pre-catalogue and pre-stage.json paths: inspector-reads-records rewrites the exporter on this cutoff",
    "Reading old records stays as it is: the journal's v1 upcaster, promptFile's brief.md, and counting a run.json without attempts from the journal",
    "A workflow file with no stage files keeps its file bytes as its pin: that is a current format, not a pinned-legacy path",
    "No model-facing text changes and the message catalogue is unchanged: the retired reason is a host row's reason, and verify/prompt-catalogue requires every entry to be reached",
    "accept does not check the workflow: no run of a retired item starts, and a result from a run an earlier release prepared is turned away when delivered"
  ],
  "records": [
    "A turned-away engine.transition row, outcome refused, whose reason is the retired text"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A spec spread into a new object loses the non-enumerable retired mark; the host reads it from the spec restore was given, which callers pass straight from loadWorkflow or workflowOf",
    "Running checkStages on every pinned load costs time on each hook; it already ran with the relaxation before"
  ]
}
```

## What this is

Finding 7 of `plan/research/design-books-cleanup.md`. The engine kept a relaxed load check for workflows pinned before
the asking timer, so an item started on one could finish, and a special refusal for workflows pinned before the stage
contract. Nothing is live (the decision file has the evidence), so both go: a pin is checked as a name is.

A pin the current check refuses is not deleted from history. The committed journals are evidence that done items'
suites read, so the spec still loads, marked retired, and `restore` replays it; the host simply never advances it, and
says to finish it on the release that started it. That moves the line from "which release pinned this" to one rule: a
workflow the engine would refuse to pin today is one it no longer runs.

The unmarked reading in `marks.js` was the other candidate. Measuring its removal showed done suites assert it, so it
stays here and is drafted as `retire-unmarked-reading`. The choices are in
`plan/decisions/2026-11-08-retire-pinned-legacy.md`.

## Done

Built in PR #176 (merged f957d02). A separate session verified it at a8e2dc5: all seven Expect lines MET (verdict
ad000c1). Released as harness-v0.1.39.

The first verdict marked cutoff-recorded NOT MET: the decision file named only the four trial roots, and the verifier
found verifier and tournament journal roots under the shared folder that it missed. Replan #177 named them and dropped
their unfinished items; the code did not change. While building, the accept-time refusal and its catalogue entry were
dropped before the build PR opened (second commit of #175): accept cannot load the engine's loader in the installed
plugin, and verify/prompt-catalogue requires every catalogue entry to be reached by its fixed runs.

The verifier noted that marks.js still describes the unmarked reading as for "a workflow pinned before marks"; that
stays true (a pre-marks pin that passes the check loads runnable), and retire-unmarked-reading owns it.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Keep a second clone at its base on main. Without
reading the builder's tests, write your own under `verify/retire-pinned-legacy/`:

- **records-readable:** for every `*/items/*.jsonl` the repo commits, load its seq-0 pin with the head's
  `loadWorkflow` from the journal root and replay it with `restore`; check the adopt trial's pin is the retired one and
  its message names the asking state.
- **retired-not-run:** copy the adopt trial's journal root to a temp folder and drive it with the head's `restore`,
  `applyEvent`, `runEffects` and `deliver` (its run folders hold returned results). Pin a pre-contract
  quick-fix copy and a copy without an `after` on `awaitingGates` in a temp root (write the blob, start the item on
  the pin), and do the same. Start a current quick-fix item in the same root and show it advances.
- **one-check:** grep `packages/engine/src` and read `loadWorkflow` and `checkStages`.
- **current-as-main:** npm test at both shas; read the test diff.
- **cutoff-recorded:** list `/mnt/project-files/*/harness/journal/items/` and `/mnt/project-files/harness/journal/`,
  and compare with the decision file.
- **retired-tests:** remove the retired check from `applyEvent`, then separately from `runEffects`; run
  `packages/engine/test/retired.test.js` and show it red each time.
- **ci:** read the ci and gates checks at the head sha.

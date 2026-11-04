```json
{
  "id": "engine-stage-contract",
  "title": "Rebuild main's engine and workflows on the stage contract from lane S",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Main's packages/engine and workflows/ are the cleaned-up lane S of the 2026-11-04 stage-contract tournament: every model stage is declared as rules, inputs (name to meaning, with task) and an output JSON Schema; the harness renders every prompt from those plus a fixed frame; the load check refuses missing parts, dangling wiring, actions off transitions and PASS/FAIL outputs without covers; every model run writes runs/<n>.<actor>/stage.json; npm test is green; and one real-model trial has reached merged on it.",
  "why": "The person wants to see, benchmark and observe every stage's instructions, its input data, its output, and how that output flows to the next stage. Main's engine cannot show any of that: its prompts are engine templates with no authored instructions (found by workflow-inspector), its inputs carry no meaning, and nothing records where a value came from or who reads it next. The 2026-11-04 tournament (scratch #44) built a stage contract in lane S, a cleanup made the wiring checked and the record complete, and two real-model trials merged on it. Adopted though it failed the tournament's primitive rule; the reasoning is plan/decisions/2026-11-04-adopt-stage-contract.md.",
  "serves": [
    "L-facts-from-source",
    "L-agents-self-report",
    "L-rules-in-spec-not-host",
    "L-missing-input-passes",
    "L-record-route-at-write",
    "L-expect-checkable-before-accept",
    "L-text-is-not-intent"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "ccp_xstate_scratch tourney/2026-11-04-stage-contract/S-cleanup at c62f5ac",
      "what": "The engine, workflows and tests to port: lane A (23c3290) plus the stage contract, cleanup rounds 1-5, the stage record fixes, the trial fixes (8d51cbf) and the trial 2 fixes (c62f5ac: build notes reach the merge cards, which now receive the ask's inputs; PR title and body rule). 3a2b4e3 is two empty commits on 8d51cbf; port c62f5ac"
    },
    {
      "ref": "/mnt/project-files/stage-contract-tournament/S-cleanup/notes.md",
      "what": "What each part of the cleanup does, with line references, its tests, mutation checks and open points"
    },
    {
      "ref": "/mnt/project-files/stage-contract-tournament/{result.md,result2.md}",
      "what": "The judge's two rounds: scenarios, contract tests P1-P6, primitives, critique fixes, new problems"
    },
    {
      "ref": "/mnt/project-files/stage-contract-tournament/{trial,trial2}/",
      "what": "The two real-model trials: report, driver (drive.mjs, gh shim), journal with stage.json per run"
    },
    {
      "ref": "ccp_xstate_scratch issue #44, PRs #42 (S) and #43 (M)",
      "what": "The tournament's tracking issue and lane PRs"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/",
      "what": "The lane S engine: stages.js (renderer, frame, load check), form.js, trace.js (stage record), actors.js, spec.js, host.js, effects/, and test/tourney/ (Q1-Q9, F1, F2, R1, P1-P6, S2-S5)"
    },
    {
      "ref": "workflows/",
      "what": "quick-fix.json, research.json and feature.json in the stage-contract form"
    },
    {
      "ref": "runs/<n>.<actor>/stage.json",
      "what": "One per model run: prompt parts with their sources, inputs with meanings, wiring and producers, output with stamped fields, writes, what each write replaced, and readBy. The format the inspector-stage-record item reads"
    },
    {
      "ref": "docs/journal.md",
      "what": "Engine rows' writes field and the stage.json format"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/",
      "what": "The tournament record: pack, config, measure, result.md, result2.md, the cleanup notes, both trial reports, and this item's trial under trials/adopt/; indexed in tournaments/README.md"
    }
  ],
  "expect": [
    {
      "id": "scenarios",
      "check": "The 12 scenario tests (Q1-Q9, F1, F2, R1) and the contract tests (P1-P6, S2-S5) pass on main's engine and workflows, with no scenario assertion weaker than on the lane at 8d51cbf",
      "how": "node --test packages/engine/test/tourney/*.test.js, and a diff of the scenario assertions against the lane",
      "proof": "builder"
    },
    {
      "id": "npm-test",
      "check": "npm test is green: every one of lane A's tests that failed on the lane (about 112, such as the old prompt wording in plugins/harness/test/actors.test.mjs and the clean-room release check) is ported to the contract or replaced by a test of the same behaviour, none deleted without a named replacement, none skipped",
      "how": "The PR's ci check at the head sha, plus the PR body's list of each replaced test and what replaces it",
      "proof": "world"
    },
    {
      "id": "trial",
      "check": "A real-model trial on this PR's head, driven as in trial2/driver (real agents given exactly brief.md plus context.md, real npm test as CI, the gh shim), takes one issue to merged with 0 schema refusals, and its report is committed under tournaments/2026-11-04-stage-contract/trials/adopt/ and linked in the PR body",
      "how": "The report, the driver log and the item's journal: zero refused accept rows of rule schema, item state done",
      "proof": "world"
    },
    {
      "id": "stage-record",
      "check": "stage.json exists for every model run, in the trial's journal and in every scenario run folder; its parts reassemble to brief.md exactly and every source pointer resolves to its text",
      "how": "The verifier's own script over the trial journal and the scenario run folders",
      "proof": "verifier"
    },
    {
      "id": "coverage",
      "check": "The verify stage's coverage check refuses a result with a missing line, with lines reordered, and with one line paraphrased (a word changed), each as rule covers, and accepts the exact set",
      "how": "The verifier's own test calling accept() through the real engine",
      "proof": "verifier"
    }
  ],
  "concepts": {
    "adds": [
      "stage contract (rules, inputs with meanings and the task input, output JSON Schema with covers)",
      "load check (form, actor kind, wiring fed on some way in, coverage)",
      "stage record (stage.json and journalled writes)",
      "blocked result (a stage's honest could-not, routed as its error)"
    ],
    "removes": [
      "role-from-schema convention",
      "engine-written prompt templates (writtenBrief and role lines)",
      "build notes field"
    ],
    "budget": 4
  },
  "non_goals": [
    "No inspector change; inspector-stage-record shows stage.json",
    "No change to tournament scoring; tournament-scoring-floors does that",
    "No stage.json for host effects or child items; their journal rows stay as they are",
    "No guard-path wiring check and no every-way-in analysis (the lane notes' Open list stays open)",
    "No fix for N3 (stage agents inheriting the parent session's instructions); this item names it and measures it"
  ],
  "records": [
    "runs/<n>.<actor>/stage.json for every model run",
    "engine.transition rows with writes [{ path, from, set }]",
    "send-back rows with the text and its hash",
    "accept refusals by rule (schema, covers, reserved)"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 4000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "N3: stage agents inherit the parent session's instructions. In trial 2 the builder put the orchestrating session's Co-Authored-By and Claude-Session trailers on its commit, though the stage prompt said nothing about trailers. The contract assumes the prompt is all an agent is told; on this host it is not.",
    "The FAIL path (verify FAIL, rebuild with the verdict) and the blocked path (build blocked, replanning with the failure) have never been taken by a real model. Both trials merged on the first build; both paths are covered only by scenario tests and offline probes on real records.",
    "Main has moved since lane A's base (5633401) and the scratch repo shares no history with it, so this is a rebuild by hand, not a merge; plugins/ code that reads the old prompts or the old actor shape may break in ways the lane never saw.",
    "Items pinned to a pre-contract workflow are refused at load (by design). Any item in flight on main's current engine must finish before this lands, or be restarted."
  ]
}
```

## What this is

The [2026-11-04 stage-contract tournament](https://github.com/suredesigntshirts/ccp_xstate_scratch/issues/44) asked
whether a stage contract makes lane A of the 2026-11-03 context tournament simpler and fixes the stage-by-stage prompt
critique at the root. Lane A ([tourney/2026-11-03-context/A-minimalist](https://github.com/suredesigntshirts/ccp_xstate_scratch/tree/tourney/2026-11-03-context/A-minimalist),
23c3290) won the first tournament by deletion and was the control. Two contract lanes,
[S](https://github.com/suredesigntshirts/ccp_xstate_scratch/pull/42) and
[M](https://github.com/suredesigntshirts/ccp_xstate_scratch/pull/43), passed all 12 scenarios and all six contract
tests by round 2, but each counted 26 weighted primitives against the control's 22, so under the rule written before
the run the judge's answer was no (`result.md`, `result2.md`). S fixed 10 of the 14 critique items by construction,
M 8.

S was then cleaned up on
[tourney/2026-11-04-stage-contract/S-cleanup](https://github.com/suredesigntshirts/ccp_xstate_scratch/tree/tourney/2026-11-04-stage-contract/S-cleanup)
(five rounds, each against an independent verifier), given a stage record, and run twice with real models
(`trial/report.md`, `trial2/report.md`). Trial 1 merged after one refusal and found nine prompt problems; the trial
fixes (8d51cbf) closed them, and trial 2 merged with no refusals. This item brings that lane to main.

## The design, as it lands

- A model stage is a `meta.actors` entry with `rules` (role first, then limits, then when to return) and `inputs`
  (name to meaning) beside its output JSON Schema. The input named `task` fills the Task part; a brief stage's fixed
  job is a literal `task` in its invoke.
- The renderer builds every prompt from those parts plus a fixed frame: the data rule (only Rules and Task instruct;
  every input is material), the worktree rule (exactly what `confine()` enforces), the return line, and the run line
  (in `context.md` only). No other prose lives in engine code; P2 scans for it.
- The load check refuses: a stage missing a part; an invoke whose actor is not a stage, a host effect or a workflow; an
  input not fed on some way into its state (dangling wiring); any action that is not a `set` on a transition the chart
  walks (`form.js`); and a stage given lines whose output may say PASS or FAIL, or that the chart decides on, without
  `covers`.
- At accept, `covers` refuses a missing, extra, repeated or out-of-order line, and a PASS that disagrees with a FAIL
  line.
- Every model run writes `runs/<n>.<actor>/stage.json`: the prompt parts with their sources, the inputs with their
  meanings, wiring and producers, and, when the run finishes, the output with its stamped fields, what it wrote, what
  each write replaced, and `readBy`.

## Porting the failing tests

On the lane, `npm test` gives 527 tests with 112 failing, all of them failing before the tournament: lane A's tests of
the old prompt wording ("You are the brief actor" in `plugins/harness/test/actors.test.mjs`), the `builds` counter, and
the clean-room release checks. On main the suite must be green. For each failing test the builder either ports it to
the contract (the behaviour it guarded still exists, under new wording or shape) or replaces it with a test of the
behaviour that superseded it, and lists the mapping in the PR body. A test is deleted only when its behaviour is gone
on purpose, and the PR says which plan item or decision removed it.

## The trial

Port `trial2/driver/drive.mjs` and its gh shim into `tournaments/2026-11-04-stage-contract/trials/adopt/driver/` and
run it against this PR's head on a fresh issue. Keep trial 2's rules: each agent gets exactly `brief.md` plus
`context.md` and the one-line note that its final message is its return; real `npm test` is CI; nothing reaches real
GitHub. Pick an issue where a half-met line is plausible, so the FAIL path has a chance to run; if it does not run,
the report says so and the risk stays named. The report counts refusals by rule and records whether N3 recurred
(trailers on the agent's commits that the prompt never asked for).

## Verifier brief

Read this item's head, then check out the PR at its head sha in a clean clone. Run
`node --test packages/engine/test/tourney/*.test.js`; diff the scenario tests (Q1-Q9, F1, F2, R1) against
ccp_xstate_scratch `tourney/2026-11-04-stage-contract/S-cleanup` at c62f5ac and confirm no assertion is weaker; for
the builder line, break one load rule in `stages.js` (for example, make every write feed every state) and name the
test that goes red. Read the ci check at the head sha and the PR body's mapping of replaced tests; spot-check five
mappings against the old test's assertion. Read the trial report under
`tournaments/2026-11-04-stage-contract/trials/adopt/`, then the journal it names: confirm the item reached `done`
through a merge, and count refused accept rows of rule `schema` (must be 0). Write your own script that finds every
model run folder in the trial journal and in the scenario runs, confirms `stage.json` is present, reassembles its
parts and compares them with `brief.md`, and resolves each source pointer against the workflow JSON. Write your own
test that calls accept() on a verify result with one line missing, with two lines swapped, and with one line's words
changed, and confirm each is refused as `covers` while the exact set is accepted. Give a verdict per Expect id.

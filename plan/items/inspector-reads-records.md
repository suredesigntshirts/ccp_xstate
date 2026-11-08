```json
{
  "id": "inspector-reads-records",
  "title": "Have the Workflow Inspector read the engine's records instead of reconstructing them",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "scripts/inspector/export.mjs takes every transition explanation from the engine's explain(spec, snapshot, event) (packages/engine/src/explain.js, built on chart() and the failingOf check the machine's bound guards run), draws the workflow map from chart(), and takes model-ness, prompt and context provenance, the prompt's writers and the host-written fields from stage.json and run.json. The string-literal scanning, the template-code display, the host-field guessing, its own graph walker and the brief.md model test are deleted, and a run without a stage record is refused by name (plan/decisions/2026-11-08-inspector-reads-records.md).",
  "why": "The inspector, the person's main view of each stage, re-derives in 1,282 lines decisions the engine already records, so an engine change silently breaks it (APOSD information leakage; research plan/research/design-books-cleanup.md, finding 6).",
  "serves": [
    "L-facts-from-source",
    "L-pages-current-on-demand"
  ],
  "depends_on": [
    "retire-pinned-legacy",
    "harness-glossary"
  ],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 6: what the exporter re-derives (graph and transition matching, string-literal provenance, the brief.md model test) and the change"
    },
    {
      "ref": "plan/decisions/2026-11-08-inspector-reads-records.md",
      "what": "What explain returns and how it shares the guard's check, what chart gains, which records replace which guesses, the cutoff for runs without stage.json, the sources dropped and the done suites this changes"
    },
    {
      "ref": "scripts/inspector/export.mjs, scripts/inspector/page.html, scripts/inspector/build.mjs, scripts/inspector/sources.json",
      "what": "The exporter, the page, the build and its default sources"
    },
    {
      "ref": "packages/engine/src/stages.js, packages/engine/src/spec.js",
      "what": "chart() and its transitions; failing(), bindTransition and the needs a transition is held to"
    },
    {
      "ref": "packages/engine/src/trace.js, docs/journal.md",
      "what": "stage.json: prompt parts with each piece's source, context, inputs with producers, stamped, wrote"
    },
    {
      "ref": "docs/inspector.md",
      "what": "How the page reads a run today, section by section"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/spec.js",
      "what": "testsOf(transition, target) and failingOf(spec, transition, target, scope), exported; bindTransition's guard is failingOf finding nothing"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "chart().transitions carry def, delay (after), invoke and on (an invoke's onDone or onError); writes unchanged"
    },
    {
      "ref": "packages/engine/src/explain.js, packages/engine/src/index.js",
      "what": "explain(spec, snapshot, event) -> { tried, taken }, re-exported from index.js with testsOf and failingOf"
    },
    {
      "ref": "scripts/inspector/export.mjs",
      "what": "Steps, ways out tried and ignored-event listeners from explain; the graph (nodes and edges named by JSON pointer) from chart(); a model run is a run folder with stage.json; prompt and context segments from the record's pieces; hostWritten from stamped; a journal root whose model run lacks stage.json, or an engine without explain.js, refused with that reason. graphOf, matchEdge, candidatesOf, listenersOf, applyActions, findInvoke, stringPieces, piecesOf, labelGap, runValuesOf, segmentsOf, jsonChunks, sourceOf, withHelpers, hostFieldsOf, stampOf, schemaDifference and the passthrough and template provenance deleted"
    },
    {
      "ref": "scripts/inspector/page.html",
      "what": "The template and passthrough provenance, the engine-code sections, the schema-difference box and the join or eventless chain removed; segment labels read the record's sources"
    },
    {
      "ref": "scripts/inspector/build.mjs, scripts/inspector/sources.json",
      "what": "A refused source is skipped and named; the October journals, the 36da3e4 engine and the lane sources dropped"
    },
    {
      "ref": "packages/engine/test/explain.test.js",
      "what": "The builder's tests: on, after, done and error events; the order deepest state first, file order within a state; a failing guard and a failing need; an ignored event; agreement with XState's own transition over every committed journal and the main tourney scenarios"
    },
    {
      "ref": "scripts/inspector/test/export.test.mjs",
      "what": "Rewritten for the new reading; the lane, October and literal-scanning tests go"
    },
    {
      "ref": "verify/inspector-stage-record/older.test.mjs",
      "what": "Deleted: it proved the October journals render as before, which this cutoff retires (decision file)"
    },
    {
      "ref": "docs/inspector.md, docs/language.md, packages/engine/README.md",
      "what": "The inspector doc says what it reads from which record and what it no longer shows; explanation in the glossary; explain in the engine README"
    }
  ],
  "expect": [
    {
      "id": "explained",
      "check": "For every applied step of every committed journal (every */items/*.jsonl the repo commits) and of the main tourney scenarios Q1, Q3, Q5 and R1 run at the head, the bundle's taken way out is the transition explain names, and XState's own transition from the replayed snapshot lands where that transition leads; every way out listed as tried has the failing tests failingOf gives on the context before the step; an event the engine did not apply lists explain's tried transitions, none taken",
      "how": "The verifier's own test replaying each journal with the head's machineOf and xstate, calling explain and failingOf itself, and comparing with exportRun's bundle",
      "proof": "verifier"
    },
    {
      "id": "one-path",
      "check": "Breaking the engine's needs binding in a scratch copy (a transition's target needs no longer checked in spec.js) changes both what the machine does and what the exported bundle says was tried, with no change under scripts/inspector/",
      "how": "The verifier's mutation of spec.js in a scratch clone, then a quick-fix item driven to a state whose needs fail, exported before and after",
      "proof": "verifier"
    },
    {
      "id": "true-to-record",
      "check": "For every model run of the adopt, blocked-retry and fail trials, every committed bench run and the main tourney scenarios: the run is shown as a model run exactly when its folder has stage.json; the prompt segments, joined, are prompt.md byte for byte, and each non-frame segment is a stage.json piece, in order, with that piece's source; the added context is the record's context piece; hostWritten is stage.json's stamped paths",
      "how": "The verifier's own test over exportRun bundles and the run folders on disk",
      "proof": "verifier"
    },
    {
      "id": "no-guessing",
      "check": "At the head, scripts/inspector/ reads no engine source file as text, has none of the deleted functions, no provenance kind passthrough, template or template+workflow, and no model test on a prompt file; its graph comes from chart(); a journal root with a model run without stage.json, and an engine checkout without explain.js, are refused naming why, and build.mjs skips them by name",
      "how": "The verifier's grep and reading of scripts/inspector/, and a build over a temp root with stage.json removed from one run",
      "proof": "verifier"
    },
    {
      "id": "page",
      "check": "The page built at the head from sources.json shows every run, every step's ways out and every model run's prompt with no console error at 1280 and 390 px, and the Stage view and flow strip as on main",
      "how": "node scripts/inspector/build.mjs then check-page.mjs at the head; verify/inspector-stage-record true-to-record and flow pass",
      "proof": "verifier"
    },
    {
      "id": "current-as-main",
      "check": "Every test that passes on main passes at the head, apart from scripts/inspector/test/export.test.mjs (rewritten) and verify/inspector-stage-record/older.test.mjs (deleted), plus the builder's new tests; no other item's verify/ folder changes",
      "how": "npm test at both shas, and the verifier's reading of the test diff",
      "proof": "verifier"
    },
    {
      "id": "explain-tests",
      "check": "The builder's explain tests go red when explain tries a parent state before its child, and when it stops at a transition whose need fails",
      "how": "The verifier breaks each in explain.js and runs packages/engine/test/explain.test.js",
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
      "explanation (the engine's account of one event: the transitions it tried, in order, with the tests that failed)"
    ],
    "merges": [
      "the inspector's ways-out check into the engine's bound guard (failingOf)"
    ],
    "removes": [
      "the inspector's own workflow graph walker and transition matching",
      "engine template provenance by scanning engine string literals",
      "host-written fields guessed from context wording and source patterns",
      "a model run known by its prompt file"
    ],
    "budget": 1
  },
  "non_goals": [
    "The page's layout, the Stage view and the flow strip stay as they are",
    "Republishing the Inspector artifact: the artifacts refresh after the eighth cleanup item does that",
    "The live capture's trace reading (outcomeOf, resumeNote) reads capture rows, not engine decisions, and stays",
    "No model-facing text changes and the message catalogue is unchanged",
    "No stage record changes: chart()'s new fields are on its transitions, which no record copies"
  ],
  "records": [
    "None new: explain reads a snapshot and writes nothing, and the inspector reads stage.json, run.json and the journal as the engine writes them"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 1500000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "Edge ids change from e<n> to JSON pointers; page links that carry an edge id must escape them",
    "A tried list that stops at the first passing transition shows fewer ways out than the old list for a taken step whose later siblings the engine never reached; that is what the engine did"
  ]
}
```

## What this is

Finding 6 of `plan/research/design-books-cleanup.md`. The Workflow Inspector worked out from the workflow file and
the engine's source text what the engine had already decided and recorded: which transition an event took and why the
others failed, which text of a prompt is the engine's, which fields the host wrote, and which runs are a model's. Each
guess breaks quietly when the engine changes. Now the engine explains each event itself (`explain`, on the same check
its guards run), the map comes from `chart()`, and everything about a model run comes from its stage record.

Runs recorded before stage records (the October journals) and the tournament lane engines are no longer shown; the
decision file has the evidence that every committed model run has a stage record, and which done suite this retires.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Keep a second clone at its base on main. Without
reading the builder's tests, write your own under `verify/inspector-reads-records/`:

- **explained:** list every `*/items/*.jsonl` the repo commits, and run `packages/engine/test/tourney/` Q1, Q3, Q5
  and R1 at the head with `TMPDIR` pointed at a kept folder to get their journal roots. For each, replay with the
  head's `machineOf` and xstate, call `explain` and `failingOf` yourself, and compare with `exportRun`'s bundle.
- **one-path:** in a scratch clone, make `spec.js` stop checking a target's needs; drive a quick-fix item (the
  host's `restore` and `applyEvent` on a temp root) to an event whose target needs fail on main; export before and
  after the mutation and show both the machine's move and the bundle's tried list change, with `scripts/inspector/`
  untouched.
- **true-to-record:** for each model run of those bundles, compare the segments, context, hostWritten and model flag
  with the run folder's `prompt.md`, `context.md` and `stage.json`.
- **no-guessing:** grep `scripts/inspector/` for the deleted names, `readFileSync` of engine source, `brief.md` and
  `promptFile` used as a model test; copy a committed journal root, delete one run's `stage.json`, and build it.
- **page:** `node scripts/inspector/build.mjs --out <dir>` and `node scripts/inspector/check-page.mjs --out <dir>` at
  the head; run `verify/inspector-stage-record/true-to-record.test.mjs` and `flow.test.mjs`.
- **current-as-main:** `npm test` at both shas; read the test diff.
- **explain-tests:** in `explain.js`, walk ancestors before the leaf, then separately skip the needs in the failing
  check; run `packages/engine/test/explain.test.js` and show it red each time.

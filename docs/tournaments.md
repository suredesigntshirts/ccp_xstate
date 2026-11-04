# Design tournaments

A tournament answers one design question by having several lanes (independent designers, plus a control) design,
build and test against one frozen pack, then judging them blind. The kit keeps the reusable part apart from each run
(plan item `tournament-kit`, decision `plan/decisions/2026-11-04-tournament-layout.md`):

| Where | What | Changes per tournament? |
|---|---|---|
| `scripts/tournament/` | The runner, the args builder, the dry run, the measure runner, the CI template, generic role prompts and schemas | No. It names no subject |
| `tournaments/<id>/` | One run: pack, config, prompts or schemas that override the kit's, its measure, its result and scores | Yes, a new folder |
| `tournaments/README.md` | The index: every tournament, its question, winner, decision and links | One row added |
| ccp_xstate_scratch | Lane code: `tourney/<id>/<lane>` branches from `tourney/<id>/base`, one draft PR each, one tracking issue | Never merged |

A suite that outlives one tournament (a future engine conformance suite, say) lives beside the code it tests, and a
tournament's `config.suite` points at it. A winner reaches `main` only as an ordinary plan item, rebuilt cleanly.

## The folder

```
tournaments/<id>/          <id> is <date>-<topic>, and config.id must equal it
  config.json              what the run is pinned to (below)
  pack.md                  the frozen problem: question, constraints, scenarios, measures (config.pack names another file)
  prompts/<role>.md        optional: overrides scripts/tournament/prompts/<role>.md
  schemas/<role>.json      optional: overrides scripts/tournament/schemas/<role>.json
  measure.mjs              optional: export measure({ checkout, config, lane }) returning this tournament's measures
  result.md, scores.json   written after the run: the final judge's result, and measure.mjs's output for each lane
  lanes/<lane>/            each lane's design and notes, copied in after the run
```

`config.json` fields. `args.mjs` refuses a folder missing any of the first six:

| Field | Meaning |
|---|---|
| `id`, `question` | The folder name, and the question in one sentence |
| `base.repo`, `base.sha` | The repo and commit every lane starts from. `base.snapshot` records the scratch base branch when it differs |
| `runner.sha` | The commit of `scripts/tournament/` the run uses (add `repo` and `path` when it ran on something else) |
| `lanes[]` | `id` (branch-safe), `alias` (the letter judges see), `stance`, and optional `skip` (stage ids), `given` (a stand-in output for a skipped stage), `brief` (`{ stageId: extra text }`) |
| `stages[]` | `id`, `role`, `over` (`each` lane or `all` lanes once), optional `title`, `brief`, and `pick` (`{ from: <earlier all-stage>, top, exclude, plus }`) to run only ranked lanes |
| `scoring.floors`, `scoring.tradeoffs` | How lanes are scored, written before the run: see Scoring below. `note`, `was` (an earlier free-text rule) and `written` are kept as record |
| `suite` | Optional: `{ command: [cmd, ...args], install }`, run in each lane checkout; TAP output is read |
| `measure` | Optional: the measure module, relative to the folder |
| `vars` | Optional: values prompts use as `{{vars.x}}` |
| `record` | After the run: the tracking issue, lane PRs, viewer, winner and the decision it fed |

A role prompt is Markdown with `{{...}}` placeholders the runner fills per call: `tournament`, `question`, `pack`,
`scoring`, `vars`, `stage`, `stages` (earlier stages' outputs), `lanes` (every lane's outputs so far, by alias),
`brief` (the stage's and the lane's extra text), and for `each` stages `lane` and `prev` (this lane's outputs so far).
`args.mjs` refuses a placeholder outside these, a `lane` placeholder in an `all` stage, and a `{{lane.x}}` that a
lane taking the stage lacks.

## Running one, end to end

1. **Write the folder.** Copy the shape above. Write the pack and `scoring` before anything runs. Pick stages:
   a design-only question can be `design` (each) then `judge` (all); a code question adds `build` (each), and maybe
   a `pick` round and a `final` judge. Leave `runner.sha` as the current `main` sha of `scripts/tournament/`.
2. **Build and check the args.**
   `node scripts/tournament/args.mjs tournaments/<id> --out args.json`, then
   `node scripts/tournament/dry-run.mjs args.json` prints every agent call with stub agents and the result shape. Fix
   anything refused before spending tokens.
3. **Run it.** Call the Workflow tool with `scriptPath: scripts/tournament/runner.workflow.js` and `args` set to the
   JSON from step 2 (the Workflow tool gives scripts no file access, so everything travels in args). The prompts say
   where lanes write; keep that in the pack or `vars`, under `/mnt/project-files/` so it outlives the container.
4. **Push the lanes.** The session pushes, not a script. In ccp_xstate_scratch: push `tourney/<id>/base` (a
   history-free snapshot of `base.sha` is fine: `git archive <sha> | tar -x`, commit), with
   `.github/workflows/tournament.yml` copied from `scripts/tournament/ci/tournament.yml` and with `scripts/tournament/`
   and `tournaments/<id>/` in it, since CI reads the kit and config from the base branch. Then push one
   `tourney/<id>/<lane>` branch per lane from that base, open one draft PR per lane into the base, label them
   `tourney:<id>`, and open one tracking issue that links them. Never merge them.
5. **Read CI.** Each lane PR's `tournament / score` job runs `measure.mjs` on the lane head and puts the suite
   results and measures in its job summary (and `measure.json` as an artifact). Judges read these instead of counting.
   For `scores.json`, run `node scripts/tournament/measure.mjs --tournament tournaments/<id> --lane <lane>
   --checkout <lane checkout> --scores` per lane.
6. **Score it.** Save the judge's output (the judge schema: per lane its floors, model stages, primitives and
   trials) as `judge.json`, then `node scripts/tournament/score.mjs tournaments/<id>` writes `scoring.json` and
   `scoring.md` (see Scoring).
7. **Record it.** Copy `result.md`, each lane's design into `lanes/<lane>/`, fill `config.record`, add a row to
   `tournaments/README.md`, and open the PR. Write the decision the result feeds in `plan/decisions/`.

## Scoring

Plan item `tournament-scoring-floors`; the reasoning is in `plan/decisions/2026-11-04-adopt-stage-contract.md` and
`plan/decisions/2026-11-04-tournament-scoring-floors.md`. A count measures what a design costs, not whether it works,
so scoring asks the job first and the cost second:

1. **Floors.** `scoring.floors` lists `scenarios`, `contractTests` and `constraints`, each as ids or `{ id, what }`. A
   lane qualifies only if the judge reports every one as passed; a floor the judge leaves out counts as failed, and
   `score.mjs` names each failed floor. No cost can buy back a failed floor. A contract-test floor means a control
   that does not attempt the question cannot qualify; when that is the point, the pack says so before the run.
2. **Trade-offs.** `scoring.tradeoffs` lists two or more costs, each `{ id, kind }`: `primitives` (from the judge,
   lower is better), `trials` (real-model trials the judge lists, more passed is better) or `measure` (a path into
   the lane's measures in `scores.json`, with `better: "lower" | "higher"`). Qualified lanes are laid side by side on
   all of them. One lane ranks above another only if it is at least as good on every trade-off and better on one;
   lanes neither beats share a tier. There is no composite score.
3. **The primitive counting rule.** The judge lists each lane's model stages as `workflow/stage` and every primitive
   with the model stages that use it (plus `workflows` where it is used outside any stage, and `weight`, default 1).
   A primitive counts only if every model stage uses it and it is used in more than one workflow: that is the
   vocabulary an author must learn to write any stage. Every other primitive is listed as a special case with the
   reason, beside the count, never dropped.

`args.mjs` refuses a scoring block with no floors, with fewer than two trade-offs, or with only a free-text `rule`, and
a prompt naming a `{{scoring.x}}` that is not there. Role prompts read the scoring as `{{scoring.text}}`, which
`args.mjs` writes from the floors and trade-offs. `score.mjs` takes `--judge`, `--scores` and `--out` to score from
files elsewhere.

If a lane PR existed before its base carried the CI, update the PR's branch from the base (GitHub's "Update branch",
a merge of the base into the lane). The lane's own changes stay as judged, and the push runs the job.

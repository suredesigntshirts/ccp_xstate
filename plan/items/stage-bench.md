```json
{
  "id": "stage-bench",
  "title": "Bench a stage's prompt alone on fixed cases, starting with the brief stage",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "Any quick-fix model stage can be run alone on committed cases with the exact prompt the engine renders, scored per rubric criterion by mechanical checks and a judge checked against hand grades, and compared across two workflow versions in a committed report. The brief stage has its first bench and a baseline from real model runs, and docs/prompts.md gives the refinement procedure a thread follows.",
  "why": "On 5 Nov the person asked how prompts are audited, changed and improved. Reading is solved: every run stores its exact prompt and the Inspector traces each line. Improving is not. A stage can only be tried in a full item run (about an hour), nothing scores whether its output is good, and editing quick-fix.json breaks a done item's replay test. So the stage rules have changed only to fit host checks since they were written on 4 Nov (L-stage-needs-bench). The five whys put this first, before an intake stage, so that intake is designed on a bench rather than shipped as another first draft (plan/decisions/2026-11-05-prompt-refinement.md).",
  "serves": [
    "L-stage-needs-bench",
    "L-verifier-independent",
    "L-checks-against-world",
    "L-measure-then-park"
  ],
  "depends_on": [
    "engine-stage-contract",
    "trial-fail-path"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/stages.js",
      "what": "sections() and render(): the only place a prompt is assembled; the bench must call these, never copy them"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "meta.actors.brief (rules, inputs, output schema) and the briefing state's task literal"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/adopt/",
      "what": "A real brief run (runs/0.brief) on the clamp issue with the half-met subtract line; driver/drive.mjs and driver/lastmsg.mjs show how a headless agent run is driven and its answer extracted"
    },
    {
      "ref": "/mnt/project-files/first-real-issue/harness/journal/items/fri-jsonl-lint-2/",
      "what": "A real brief run on a product-repo issue (pre-contract prompt), usable as a case's input"
    },
    {
      "ref": "/mnt/project-files/research/gan-and-harness-design/05-distilled.md",
      "what": "Findings 3 and 5: judge self-preference, and a calibration set of known-good and planted-bad outputs"
    },
    {
      "ref": "plan/decisions/2026-11-04-stage-contract-followups.md",
      "what": "The brief command that could not run as written: a rubric criterion"
    },
    {
      "ref": "verify/trial-fail-path/trials.test.mjs",
      "what": "Asserts each trial journal's pin equals the current quick-fix.json hash, so any prompt edit turns it red"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/bench/",
      "what": "run.mjs (render with the engine, run one stage headless k times per case in a worktree at the case's commit, write run folders), score.mjs (mechanical checks, then a judge session per rubric criterion), compare.mjs (two workflow versions, per case and criterion), with tests"
    },
    {
      "ref": "bench/brief/",
      "what": "cases/ (inputs plus must_catch and must_not per case), rubric.json, judge-check/ (hand-graded outputs), reports/baseline.md and the baseline's run folders"
    },
    {
      "ref": "docs/prompts.md",
      "what": "Where each part of a stage's prompt comes from, how to inspect a run, and the refinement procedure: rubric approved by the person or stand-in, cases, baseline, proposal tied to a failing criterion, rerun, blind A/B by a fresh session, PR with report"
    },
    {
      "ref": "Journal replay",
      "what": "Committed journals replay on the workflow blob they pinned, so a prompt edit leaves done items' replay tests green"
    }
  ],
  "expect": [
    {
      "id": "same-prompt",
      "check": "For every model stage of quick-fix and a recorded input, the prompt the bench sends is byte for byte the prompt render() gives for the same workflow version and input, and for the adopt trial's brief input it equals the committed runs/0.brief/brief.md",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "alone",
      "check": "The bench runs the brief stage on one case with no GitHub access and no CI, and writes a run folder that scripts/inspector/build.mjs turns into a page showing that run's prompt, input and result",
      "how": "The verifier runs it with GitHub unreachable and builds the Inspector from the folder",
      "proof": "verifier"
    },
    {
      "id": "cases",
      "check": "bench/brief/cases holds at least 6 cases: at least 2 from real runs, and at least 3 planted (a half-met line, a line not checkable before merge, a line that prescribes a fix, a missing obvious line), each with must_catch and must_not lists",
      "how": "The verifier reads the cases and checks each planted trap is really present in its case's repo",
      "proof": "verifier"
    },
    {
      "id": "judge-checked",
      "check": "On bench/brief/judge-check (at least 6 hand-graded brief outputs, at least 3 of them planted bad), the scorer never grades a planted-bad output's failing criterion as met, and its agreement with the hand grades is reported per criterion",
      "how": "The verifier runs the scorer, and adds one planted-bad output of its own that the scorer must also catch",
      "proof": "verifier"
    },
    {
      "id": "baseline",
      "check": "bench/brief/reports/baseline.md reports real model runs of today's brief prompt, at least 3 per case, with per-case per-criterion scores, time and tokens per run, and whether this host's ambient instructions reached the run; its run folders are committed and match the report",
      "how": "The verifier reads the run folders, recomputes the scores with score.mjs, and reruns one case itself",
      "proof": "world"
    },
    {
      "id": "edit-safe",
      "check": "With one rule of meta.actors.brief changed in quick-fix.json, npm test stays green except for tests that assert the current file's contents, and every committed journal still replays",
      "how": "The verifier's own test edits a rule in a scratch clone and runs npm test",
      "proof": "verifier"
    },
    {
      "id": "procedure-runs",
      "check": "Every command docs/prompts.md gives runs as written from a clean clone, and compare.mjs on the baseline against a one-rule variant writes a report",
      "how": "The verifier runs each command",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "stage bench: cases, rubric, runner, scorer, report"
    ],
    "budget": 1
  },
  "non_goals": [
    "No change to any stage's rules or to the workflow chart: the baseline measures today's prompts",
    "No bench yet for build or verify: their cases need repos with defects, and come with their own refinement items",
    "No refinement run inside the workflow: the bench is a dev-time tool (plan/decisions/2026-11-05-prompt-refinement.md)",
    "No single overall score: per-criterion results only, so a regression on one criterion cannot hide behind a gain on another"
  ],
  "records": [
    "each bench run's folder: prompt, input, result, time, tokens, workflow version",
    "the baseline report",
    "the judge-check agreement table"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

The first of three items from the 5 Nov prompt-refinement plan (`plan/decisions/2026-11-05-prompt-refinement.md`). It
makes a stage's prompt measurable without a full item run. The brief stage goes first because it exists today and
writes the work packet every later stage runs on. `wf-intake` and `refine-brief-stage` are then built on this bench.

A judge that grades briefs is itself a model, so it gets checked: hand-graded outputs with planted faults, and the
verifier adds one of its own. A brief rubric starts from what the runs have shown: one check per expect line that
tests the line's words, commands that run as written, traps in the repo found (the half-met `subtract` line), no fix
prescribed beyond the lines, and nothing the builder could game. The person or stand-in approves the rubric as part
of the procedure. For this item the building thread acts as stand-in and records it.

On edit-safe: today `verify/trial-fail-path/trials.test.mjs` asserts each trial journal's pin equals the current
file's hash. The builder decides how journals replay on their pinned blob (the engine's `loadWorkflow` can already
restore a pinned blob) and records the choice. Changing a done item's verifier test is allowed only to make it check
the same outcome against the pinned blob, and the decision file says so.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under `verify/stage-bench/`
without reading the builder's. For same-prompt, call `render()` yourself for each quick-fix model stage and compare it
with what `scripts/bench/run.mjs` would send, without running a model, and compare the adopt trial's brief input
with its committed `brief.md`. For alone, run one brief case with GitHub unreachable (for example `GH_TOKEN` unset and
github.com blocked for the process), then build the Inspector from the run folder. For cases, open each planted case's
repo and confirm the trap is there. For judge-checked, run the scorer on `bench/brief/judge-check/` and on one
planted-bad brief you write. For baseline, recompute the scores from the committed run folders and rerun one case. For
edit-safe, change one brief rule in a scratch clone and run `npm test`. For procedure-runs, run every command in
`docs/prompts.md`. Read the ci check at the head sha. Commit `verify/stage-bench/verdict.json` with a verdict per
Expect id.

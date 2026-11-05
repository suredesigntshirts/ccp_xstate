```json
{
  "id": "refine-brief-stage",
  "title": "Refine the brief stage's work packet on its bench",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The brief stage's rules are rewritten from the research adopt list and the bench, with one criterion per expect line and its proof kind, the builder given criteria and steps, the verifier's methods kept to the verifier, traps found in the repo named, and every check command dry-run before the brief is fixed; each change is kept only where bench/brief scores improve without a regression, and a blind A/B read by a fresh session agrees.",
  "why": "The brief is the work packet every later stage runs on, and its rules are a first draft from the 4 Nov tournament that has never been changed for quality (L-stage-needs-bench). The bench baseline shows where it fails: checks stricter than their lines (words-only 6 of 21), commands that cannot run (runs-as-written 14 of 21), and the after-merge trap sprung every time (0 of 3). The research adopt list (05-distilled findings 2, 3 and 6) says what should change, and since wf-intake the issue may carry proof kinds, non-goals and assumptions the brief ignores; only the bench can say whether each change helps (plan/decisions/2026-11-05-refine-brief-stage-ready.md).",
  "serves": [
    "L-stage-needs-bench",
    "L-verifier-independent",
    "L-no-checks-the-builder-writes"
  ],
  "depends_on": [
    "stage-bench",
    "stage-prompt-files",
    "wf-intake"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-05-refine-brief-stage-ready.md",
      "what": "The candidate changes, each tied to the criterion it targets; the two new criteria; the intake-shaped cases; how variants are run and kept"
    },
    {
      "ref": "bench/brief/",
      "what": "The rubric, 7 cases, judge check and the 21-run baseline (bench/brief/reports/baseline.md, What the baseline shows)"
    },
    {
      "ref": "workflows/quick-fix/brief.md",
      "what": "Today's brief stage file, the version the baseline ran (its rendered prompt is byte for byte the baseline's; the pin differs only through other stages)"
    },
    {
      "ref": "workflows/intake.json",
      "what": "The #shaped issue and #proof schemas: the fields an issue from intake now carries into quick-fix"
    },
    {
      "ref": "docs/prompts.md",
      "what": "The refinement procedure: rubric, cases, judge check, baseline, one-change variants, compare, blind read, PR"
    },
    {
      "ref": "scripts/bench/",
      "what": "run.mjs, score.mjs, compare.mjs and stages.mjs (brief's mechanical criteria and judge view)"
    },
    {
      "ref": "/mnt/project-files/research/gan-and-harness-design/05-distilled.md",
      "what": "Findings 2 (criteria to the builder, methods kept to the verifier), 3 and 6"
    }
  ],
  "outputs": [
    {
      "ref": "workflows/quick-fix/brief.md",
      "what": "The refined brief stage file: the baseline plus exactly the kept changes"
    },
    {
      "ref": "bench/brief/rubric.json",
      "what": "Two new criteria, builder-criteria (mechanical) and methods-private (judged), approved by the stand-in"
    },
    {
      "ref": "scripts/bench/stages.mjs",
      "what": "brief's builder-criteria mechanical check, with a test"
    },
    {
      "ref": "bench/brief/cases/, bench/brief/judge-check/",
      "what": "At least 2 intake-shaped cases (issue with proofs, non_goals, assumptions) with traps in their repos; hand-graded outputs for the new criteria, planted bad among them"
    },
    {
      "ref": "bench/brief/runs/, bench/brief/reports/",
      "what": "Baseline runs for the new cases, one run set per variant tried and one for the combined version, their reports and compares, and the blind read with its key"
    },
    {
      "ref": "docs/prompts.md",
      "what": "The brief's new criteria and cases in the benched-stages table; what the brief does with intake's fields"
    }
  ],
  "expect": [
    {
      "id": "rubric",
      "check": "bench/brief/rubric.json has builder-criteria (mechanical: the builder brief quotes every expect line word for word) and methods-private (judged: the builder brief carries no verifier PASS or FAIL condition and no probe written for the verifier), approved by the stand-in and recorded in plan/decisions/; the judge check has at least 2 planted-bad outputs for methods-private, score.mjs --judge-check passes, and the baseline report scores all 21 old runs on both new criteria",
      "how": "The verifier reruns score.mjs --stage brief --judge-check and --runs bench/brief/runs/baseline --no-judge, and plants one builder brief of its own that copies a verifier check to see builder-criteria and the kept methods-private verdicts behave",
      "proof": "verifier"
    },
    {
      "id": "cases",
      "check": "bench/brief/cases has at least 2 new cases whose input issue carries proofs, non_goals and assumptions as intake's #shaped schema writes them, each with a trap that really is in its repository and must_catch and must_not lines; the baseline set has 3 runs of each, and the 7 old cases are unchanged",
      "how": "The verifier validates each new case's issue against intake's #shaped schema with the engine, reads each seed repo for its trap, and diffs the old cases against main",
      "proof": "verifier"
    },
    {
      "id": "variants",
      "check": "Each candidate change named in the decision was run as its own one-change variant of the baseline brief file on every case at k = 3 with the baseline's model, scored, and compared with compare.mjs; for each, the PR names the criterion it targets and says kept or dropped by the procedure's rule (the targeted criterion improves and none is worse, or a trade accepted in writing in plan/decisions/)",
      "how": "The verifier diffs each variant's recorded stage file against the baseline's (exactly one change), recomputes each set's scores with --no-judge and each compare from the committed run folders",
      "proof": "verifier"
    },
    {
      "id": "kept",
      "check": "workflows/quick-fix/brief.md on the branch is the baseline file plus exactly the kept changes; that combined version was run on every case at k = 3 and compared with the baseline, scoring no criterion lower in total than the baseline unless a trade is accepted in plan/decisions/; and a blind read by a fresh session that saw neither version is committed with its key",
      "how": "The verifier rebuilds the combined file from the baseline and the kept changes and diffs it, recomputes the combined compare with --no-judge, and reads the blind read and key",
      "proof": "verifier"
    },
    {
      "id": "real",
      "check": "A real model run of the branch's brief stage through scripts/bench/run.mjs on a case the verifier writes itself (an issue on a seed repo with one trap it plants) returns briefs in which every verifier command runs as written in that repo at the case commit, and the builder brief quotes every expect line and gives no verifier PASS or FAIL condition",
      "how": "The verifier writes the case, runs the stage with a real model, and runs each command the briefs give in the case repo",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No change to the build or verify stage files, the brief's output schema, or any other workflow's brief: build and verify get their own refinement items",
    "No change to the engine, render(), accept() or the coverage rule: the brief stays two strings, and criteria live inside them",
    "No change to the 7 existing cases or their committed baseline runs; the baseline only gains runs for the new cases and verdicts for the new criteria",
    "No verifier calibration set (research finding 5): that is verify's bench, in its own item"
  ],
  "records": [
    "bench/brief/runs/<set>/ run folders (brief.md, stage.json, result.json, bench.json, transcript.jsonl) for each new baseline case, variant and the combined version",
    "bench/brief/reports/ per variant and combined: scores, compare and the blind read with its key",
    "the kept and dropped changes, each with its targeted criterion, in plan/decisions/2026-11-05-refine-brief-stage-ready.md"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 9000000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

The brief stage writes the work packet every later stage of quick-fix runs on. This item refines its stage file on
its bench, by the `docs/prompts.md` procedure: each candidate change is one change to `workflows/quick-fix/brief.md`,
aimed at one criterion the baseline fails, run on the same cases with the same k and model, and kept only where the
compare says so. The kept changes are then run together once more, and a fresh session reads them blind.

The candidates, the two new criteria and the intake-shaped cases are fixed in
`plan/decisions/2026-11-05-refine-brief-stage-ready.md`. Build and verify get their own refinement items after this
one. Verify's bench is the calibration set from research finding 5.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under
`verify/refine-brief-stage/` without reading the builder's. For rubric, run
`node scripts/bench/score.mjs --stage brief --judge-check` and
`--runs bench/brief/runs/baseline --no-judge --report <tmp>`, compare with the committed report, and score a builder
brief you write that copies a verifier check, with the mechanical criterion. For cases, validate each new case's
issue against intake's `#shaped` schema through the engine, read each seed repo for its trap, and diff the 7 old
cases and their baseline runs against `main`. For variants and kept, read the decision's list of candidates, diff each
variant set's recorded stage file against the baseline's, recompute every set's scores and compares with `--no-judge`,
rebuild the combined file from the kept changes and diff it with `workflows/quick-fix/brief.md`, and read the blind
read and its key. For real, write your own case (an issue on a small seed repo with a trap you plant), run the brief
stage with a real model through `scripts/bench/run.mjs`, and run every command the briefs give in that repo. Read
the ci check at the head sha. Commit `verify/refine-brief-stage/verdict.json` with a verdict per Expect id.

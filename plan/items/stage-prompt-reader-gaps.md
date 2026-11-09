```json
{
  "id": "stage-prompt-reader-gaps",
  "title": "Close the gaps a fresh reader finds in the model stages' prompts",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The quick-fix stage files answer each gap fresh readers of the rendered brief, build and verify prompts named: brief gives the builder no CI wait or later push, writes each check to run on its own, names issue.proofs as an input, quotes expect lines word for word and reads the repository as it needs; build returns at once even where its task says to wait and sets no other key in pr; verify grades stricter conditions in task as advisory, undoes changes to tracked files and returns issue as { url, expect }; the brief stage's bench shows no criterion worse than today's prompt beyond one run in 27.",
  "why": "Refine rounds 6, 7, 9 and 10 found each unclear rule by giving a fresh session only what it reads and asking where it guessed, but only for the texts builders and verifiers of this repo read; three fresh readers given only a stage agent's context and prompt (9 Nov, at main a63da4cd) named contradictions and undefined names in all three quick-fix stages (L-stage-needs-bench; research plan/research/stage-prompt-readers.md; decisions plan/decisions/2026-11-09-stage-prompt-reader-gaps.md).",
  "serves": [
    "L-stage-needs-bench",
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "after-verdict-gaps"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-09-stage-prompt-reader-gaps.md",
      "what": "Read first: each gap taken and its answer, and how the change is proved"
    },
    {
      "ref": "plan/research/stage-prompt-readers.md",
      "what": "The three readers' answers"
    },
    {
      "ref": "workflows/quick-fix/brief.md, build.md, verify.md; docs/prompts.md; bench/brief/",
      "what": "The stage files, the refinement procedure and the brief stage's bench"
    }
  ],
  "outputs": [
    {
      "ref": "workflows/quick-fix/brief.md, workflows/quick-fix/build.md, workflows/quick-fix/verify.md",
      "what": "Each gap's answer from the decision's table"
    },
    {
      "ref": "workflows/research/verify.md",
      "what": "The same two verify answers (task, not the brief; the issue output as url and expect), since its rules match quick-fix's"
    },
    {
      "ref": "packages/engine/test/prompts.test.js, packages/engine/test/tourney/S5.test.js, test/regression/engine/stage-files.test.mjs",
      "what": "Tests that quote a changed rule as a fixture or assert its words follow the new words"
    },
    {
      "ref": "bench/brief/runs/baseline-2026-11-09/, bench/brief/runs/variant-reader-gaps/",
      "what": "Today's prompt and the changed one, 3 runs per case on all 9 cases, scored"
    },
    {
      "ref": "bench/brief/reports/compare-reader-gaps.md",
      "what": "compare.mjs over the two run sets"
    }
  ],
  "expect": [
    {
      "id": "brief-answers",
      "check": "At the head, the rendered brief prompt (run.mjs --stage brief --prompt-only) says to give the builder no step that waits for CI or pushes after the PR is open, that each check's commands run on their own, names proofs among the issue's parts, says to quote each expect line word for word, and lets the brief writer read the repository",
      "how": "The verifier renders the prompt at the head and checks it for the words that carry each rule",
      "proof": "verifier"
    },
    {
      "id": "build-verify-answers",
      "check": "At the head, the rendered build prompt says to return at once even where task says to wait for CI, that a red check comes back as failure, and no longer names key, gates, green or checkout; the rendered verify prompt calls the stricter source task rather than the brief, undoes changes to tracked files, and describes the issue output as url and expect without a list of keys it may leave out",
      "how": "The verifier renders both prompts at the head from a recorded input and checks them",
      "proof": "verifier"
    },
    {
      "id": "fresh-readers",
      "check": "Fresh headless sessions given only the context and rendered prompt of each of the three stages at the head, asked as plan/research/stage-prompt-readers.md asked, name none of the gaps the decision's table took",
      "how": "The verifier renders the prompts at the head, runs claude -p with an empty HOME on each, and grades the answers against the table",
      "proof": "world"
    },
    {
      "id": "bench-not-worse",
      "check": "The committed run sets bench/brief/runs/baseline-2026-11-09 and bench/brief/runs/variant-reader-gaps each hold 27 scored runs on today's and the head's brief prompt respectively, and compare.mjs over them shows no criterion where the variant passes more than one run fewer than today's prompt",
      "how": "The verifier reruns compare.mjs over the committed run sets, and checks each set's workflow version against the base's and the head's stage files",
      "proof": "verifier"
    },
    {
      "id": "suite-and-scope",
      "check": "node plan/check.mjs and npm test pass at the head, and the PR changes only the files the outputs name and its own plan item",
      "how": "The verifier runs both and reads the diff's file list",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and verdict checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [
      "key, gates, green and checkout as names a build agent reads"
    ],
    "budget": 0
  },
  "non_goals": [
    "No change to the message catalogue, the engine or the workflow JSON; only the three stage files",
    "No bench for build or verify; their changes remove contradictions and undefined names",
    "intake and research stages are not read in this round"
  ],
  "records": [
    "The two scored run sets and the compare report under bench/brief/",
    "The fresh readers' answers at the head, as the fresh-readers evidence file"
  ]
}
```

## What this is

The round the refine rounds pointed at: rounds 6 to 10 read the repo's own rule texts on a fresh reader; this one
reads what the harness hands its model stages. The person asked for it on 9 Nov, ahead of the engine items it first
waited on (`plan/decisions/2026-11-09-stage-prompt-reader-gaps.md` says why that is safe).

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Render prompts with
`node scripts/bench/run.mjs --stage <stage> --prompt-only`: brief with `--case real-jsonl-lint`; build and verify with
`--input` on a JSON input you write from that case's issue and a brief from `bench/brief/runs/baseline/real-jsonl-lint.1`
(build: task, issue, base, branch, previous, verdict, failure; verify: task, issue, target { url, at }, checkout).
Read rule texts by the words that carry each rule (`docs/layout.md`, Tests). For `fresh-readers`, give each session the
question under The question in `plan/research/stage-prompt-readers.md`, the context and the prompt, and no repository;
start it with `env -u CLAUDE_CODE_REMOTE_SESSION_ID` and an empty `HOME`. For `bench-not-worse`, do not rerun the
bench (it costs about 54 model sessions): rerun `node scripts/bench/compare.mjs --stage brief` over the committed sets,
and check each set's `bench.json` workflow version names the stage files it claims.

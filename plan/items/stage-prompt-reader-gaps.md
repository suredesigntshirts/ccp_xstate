```json
{
  "id": "stage-prompt-reader-gaps",
  "title": "Close the gaps a fresh reader finds in the model stages' prompts",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "The quick-fix build and verify stage files answer each gap fresh readers of their rendered prompts named: build returns at once even where its task says to wait for CI, since a red check comes back as failure, pushes nothing after it returns and sets no other key in pr; verify (and research's verify, which shares its rules) grades stricter conditions in task as advisory, undoes changes to tracked files and returns issue as { url, expect }. The brief stage file is unchanged: its changed prompt scored worse than today's on six of ten bench criteria, and the two run sets and their compare report are committed as the record of that trial.",
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
      "ref": "workflows/quick-fix/build.md, workflows/quick-fix/verify.md, workflows/research/verify.md",
      "what": "Each build and verify answer from the decision's table"
    },
    {
      "ref": "test/regression/engine/bench-prompts.test.mjs",
      "what": "Reads a committed brief run's prompt through promptFile(), so the new run sets, which write prompt.md, replay with the older ones that wrote brief.md"
    },
    {
      "ref": "packages/engine/test/tourney/S5.test.js",
      "what": "Its assertion of verify's grading rule follows the new words"
    },
    {
      "ref": "bench/brief/runs/baseline-2026-11-09/, bench/brief/runs/variant-reader-gaps/",
      "what": "Today's brief prompt and the rejected changed one, 3 runs per case on all 9 cases, scored"
    },
    {
      "ref": "bench/brief/variants/reader-gaps/",
      "what": "The rejected brief variant's workflow copy, as earlier variants are kept"
    },
    {
      "ref": "bench/brief/reports/compare-reader-gaps.md",
      "what": "compare.mjs over the two run sets"
    }
  ],
  "expect": [
    {
      "id": "build-verify-answers",
      "check": "At the head, the rendered build prompt says to return at once even where task says to wait for CI, that a red check comes back as failure, and no longer names key, gates, green or checkout; the rendered verify prompts of quick-fix and research call the stricter source task rather than the brief, undo changes to tracked files, and describe the issue output as url and expect without a list of keys it may leave out",
      "how": "The verifier renders the prompts at the head from recorded inputs and checks them for the words that carry each rule",
      "proof": "verifier"
    },
    {
      "id": "brief-unchanged",
      "check": "The PR does not change workflows/quick-fix/brief.md, so the brief stage renders the same prompt at the base and the head",
      "how": "The verifier renders the brief prompt for one case at the base and at the head and compares them",
      "proof": "verifier"
    },
    {
      "id": "fresh-readers",
      "check": "Fresh headless sessions given only the context and rendered prompt of the build and verify stages at the head, asked as plan/research/stage-prompt-readers.md asked, name none of the build and verify gaps the decision's table took",
      "how": "The verifier renders the prompts at the head, runs claude -p with an empty HOME on each, and grades the answers against the table",
      "proof": "world"
    },
    {
      "id": "bench-recorded",
      "check": "bench/brief/runs/baseline-2026-11-09 and bench/brief/runs/variant-reader-gaps each hold 27 scored runs, the first on the base's brief prompt and the second on bench/brief/variants/reader-gaps, and compare.mjs over them reproduces bench/brief/reports/compare-reader-gaps.md's per-criterion table",
      "how": "The verifier reruns compare.mjs over the committed run sets and checks each set's bench.json workflow version",
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
    "No change to brief.md: its trial lost on the bench, and a narrower brief change waits for its own trial",
    "No change to the message catalogue, the engine or the workflow JSON",
    "No bench for build or verify; their changes remove contradictions and undefined names",
    "intake and research's other stages are not read in this round"
  ],
  "records": [
    "The two scored run sets, the variant and the compare report under bench/brief/",
    "The fresh readers' answers at the head, as the fresh-readers evidence file"
  ]
}
```

## What this is

The round the refine rounds pointed at: rounds 6 to 10 read the repo's own rule texts on a fresh reader; this one
reads what the harness hands its model stages. The person asked for it on 9 Nov, ahead of the engine items it first
waited on (`plan/decisions/2026-11-09-stage-prompt-reader-gaps.md` says why that is safe).

## Replanned after the bench

Before the build PR opened, a replan dropped the brief answers after their bench trial lost
(`plan/decisions/2026-11-09-stage-prompt-reader-gaps.md`, The brief trial).

## Verifier brief

Check out the PR head in a clean clone and run `npm ci`. Render prompts with
`node scripts/bench/run.mjs --stage <stage> --prompt-only`: build and verify with
`--input` on a JSON input you write from that case's issue and a brief from `bench/brief/runs/baseline/real-jsonl-lint.1`
(build: task, issue, base, branch, previous, verdict, failure; verify: task, issue, target { url, at }, checkout).
Read rule texts by the words that carry each rule (`docs/layout.md`, Tests). For `fresh-readers`, give each session the
question under The question in `plan/research/stage-prompt-readers.md`, the context and the prompt, and no repository;
start it with `env -u CLAUDE_CODE_REMOTE_SESSION_ID` and an empty `HOME`. For `bench-recorded`, do not rerun the
bench (it costs about 54 model sessions): rerun `node scripts/bench/compare.mjs --stage brief` over the committed sets,
and check each set's `bench.json` workflow version names the stage files it claims. research's verify takes the same
`--input` as quick-fix's (`--workflow` or the stage's workflow from `scripts/bench/stages.mjs`).

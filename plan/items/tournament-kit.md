```json
{
  "id": "tournament-kit",
  "title": "Make design tournaments a reusable, recorded kit",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Any design question can be run as a tournament from a folder of inputs: a generic runner turns tournaments/<id>/ (pack, config, prompts, shared suite, measure) into one workflow run, the lanes land as branches and draft PRs in the scratch repo, and CI on those PRs, not an agent, produces each lane's suite results and measures. The first tournament (2026-11-03-context) is recorded this way.",
  "why": "The 2026-11-03 context tournament lived in one session: its prompts sat inside a workflow script, each lane's code sat in a scratchpad that dies with the container (rescued by hand to ccp_xstate_scratch #36-#41), each lane wrote its own tests, and a judge counted primitives by hand, so the ranking rested on counting rules and self-written tests. The person asked for the pattern organised in GitHub so it can be reused for different tournaments (thread 'Show what's waiting and the architecture', 2026-11-04 03:04-03:08Z). Generic runner plus per-tournament inputs keeps a new tournament to a new folder.",
  "serves": [
    "L-plans-need-independent-read",
    "L-container-is-ephemeral",
    "L-agents-self-report",
    "L-count-concepts"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "ccp_xstate_scratch branch tourney/2026-11-03-context/base, tournaments/2026-11-03-context/",
      "what": "The first tournament's pack, result, designs, runner.js (prompts inline) and viewer"
    },
    {
      "ref": "ccp_xstate_scratch PRs #37-#41 and issue #36",
      "what": "The five lanes as judged, one draft PR each"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/tournament/",
      "what": "Generic runner: runner.workflow.js (stages and roles from args, never names a subject), args.mjs (builds the run's args from a tournament folder), measure.mjs (runs the tournament's suite and measure in a lane checkout, writes JSON), ci/tournament.yml (the scratch CI template), prompts/<role>.md (designer, executor, judge, final judge)"
    },
    {
      "ref": "tournaments/README.md",
      "what": "Index of every tournament: id, question, winner, decision it fed, links"
    },
    {
      "ref": "tournaments/2026-11-03-context/",
      "what": "The first tournament retrofitted: pack.md, config.json, result.md, scores.json, lanes/*/design.md, measure.mjs, and the runner sha it ran on"
    },
    {
      "ref": "docs/tournaments.md",
      "what": "How to run one: write the folder, build args, run, push lanes, read CI"
    },
    {
      "ref": "CLAUDE.md, docs/layout.md",
      "what": "tournaments/ added to the layout"
    }
  ],
  "expect": [
    {
      "id": "generic",
      "check": "scripts/tournament/ names no tournament, workflow, lane or engine path; runner.workflow.js takes stages, roles and scoring only from args; a toy tournament folder with a different subject and no build stage (design and judge only) produces valid args with args.mjs and runs through the runner with stub agents to a result",
      "how": "grep plus the verifier's own toy tournament folder and a dry run",
      "proof": "verifier"
    },
    {
      "id": "pinned",
      "check": "Each tournament folder's config.json records the base repo and sha, the lanes, the stages, the scoring rule and the runner sha; args.mjs refuses a folder missing any of them",
      "how": "The verifier's test removing each field in turn",
      "proof": "verifier"
    },
    {
      "id": "measure",
      "check": "measure.mjs run in each 2026-11-03-context lane checkout reproduces the judged test counts (A 27, B 19, C 22, D 22, E 22 passing) and reports spec lines per workflow and the workflow-level primitive tallies (state kinds, transition kinds, ops, guard forms, effects, events, meta keys, interpreter files changed) as JSON",
      "how": "node scripts/tournament/measure.mjs in five checkouts of the scratch lane branches",
      "proof": "verifier"
    },
    {
      "id": "ci-scratch",
      "check": "On ccp_xstate_scratch, tourney/2026-11-03-context/base carries the tournament CI from ci/tournament.yml, and each of the five lane PRs shows a job whose summary has that lane's suite results and measures, produced by CI",
      "how": "The check runs and job summaries on scratch PRs #37-#41 at their head shas",
      "proof": "world"
    },
    {
      "id": "index",
      "check": "tournaments/README.md lists 2026-11-03-context with its question, winner, scratch issue and viewer links, and docs/tournaments.md walks a new tournament end to end",
      "how": "Read",
      "proof": "builder"
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
      "tournament folder (pack, config, suite, measure)",
      "generic tournament runner"
    ],
    "budget": 2
  },
  "non_goals": [
    "No shared blind conformance suite for the engine yet; that is its own item once finalists are chosen",
    "No real-agent benchmark runs",
    "No change to packages/ or workflows/",
    "No automatic pushing of lane branches from a script; the session pushes, as docs/tournaments.md says"
  ],
  "records": [
    "tournaments/<id>/scores.json written by measure.mjs",
    "CI job summaries on the scratch lane PRs"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 2000000
  },
  "verifier": "A separate subagent, using the Verifier brief below.",
  "risks": [
    "The Workflow tool gives scripts no file access, so the runner gets prompts and config through args; a very large pack may hit the args size limit.",
    "Primitive tallies from workflow JSON cannot see interpreter features the JSON doesn't use; measure reports interpreter files changed, and the judge still weights them."
  ]
}
```

The first tournament's record is in ccp_xstate_scratch issue #36. This item moves the reusable part into this repo and
leaves the lane code in the scratch repo, where it is never merged.

Split: `scripts/tournament/` is the same for every tournament and knows nothing about the subject.
`tournaments/<id>/` holds everything specific to one run. A suite that outlives a tournament, such as a future engine
conformance suite, lives beside the code it tests, and a tournament's config points at it.

## Verifier brief

Read this item's head. Without reading the builder's tests, write a toy tournament folder of your own on a subject
other than the engine (for example "how should a README be structured"), with only design and judge stages. Build its
args with scripts/tournament/args.mjs and dry-run runner.workflow.js with stub agents. Confirm nothing in
scripts/tournament/ names a tournament, lane, workflow or engine path. Delete each required config field in turn and
confirm args.mjs refuses. Check out the five scratch lane branches of 2026-11-03-context, run measure.mjs in each, and
compare test counts with A 27, B 19, C 22, D 22, E 22. Read the check runs and job summaries on scratch PRs #37-#41 at
their head shas. Read the ci check at this PR's head sha. Give a verdict per Expect id.

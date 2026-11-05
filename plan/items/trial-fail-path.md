```json
{
  "id": "trial-fail-path",
  "title": "Drive the FAIL and blocked paths with real agents",
  "stage": "s5-parity",
  "kind": "probe",
  "status": "ready",
  "outcome": "Two real-model trials on main's engine are committed under tournaments/2026-11-04-stage-contract/trials/: in fail/, one quick-fix item goes through verify FAIL, a rebuild whose input carries that verdict, verify PASS at the new head and merged; in blocked/, a build that the world refuses returns blocked and the item stops at replanning with the build's reason on the card. Each report counts refusals by rule and says whether the stage prompts carried the agents through without coaching.",
  "why": "Three real-model trials of the stage contract (trial 1, trial 2 and the engine-stage-contract adopt trial) all merged on the first build, so the FAIL to rebuild loop and the blocked route have only ever been taken by scenario tests and offline probes. In the adopt trial the brief writer read the repo and defused the planted half-met line before the builder saw it, so a trap the brief writer can see does not reach verify; the issue must fail for a reason only running the code reveals, or the first build must be made to miss a line.",
  "serves": [
    "L-replan-after-second-fail",
    "L-checks-against-world"
  ],
  "depends_on": [
    "engine-stage-contract"
  ],
  "inputs": [
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/adopt/driver/",
      "what": "The adopt trial's driver (drive.mjs, lastmsg.mjs, the gh shim and its wrapper): the tourney fake GitHub, a local bare origin, real npm test as CI, and a hand-off at every model run"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/adopt/report.md",
      "what": "The adopt trial's method and report shape: the one-line trial note, refusals by rule, per-stage notes, stage record check"
    },
    {
      "ref": "workflows/quick-fix.json",
      "what": "verifying's onDone (failed goes back to building with the verdict), build's input (previous, verdict, failure) and its blocked alternative, replanning's card input (verdict, failure)"
    },
    {
      "ref": "plan/decisions/2026-11-05-trial-fail-path.md",
      "what": "How each trial is made to take its route (an injected first build for fail, a workflow-scope push refusal for blocked), and why"
    }
  ],
  "outputs": [
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/fail/",
      "what": "report.md, driver/, journal/ (the item's runs with brief.md, context.md, stage.json, result.json) and run/ (driver log, shim calls, gh state, CI logs, the exact prompts, the raw answers, the injected build's diff)"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/blocked/",
      "what": "The same for the blocked trial, with the origin's refused push in run/"
    },
    {
      "ref": "tournaments/README.md",
      "what": "The stage-contract row links both trial reports"
    }
  ],
  "expect": [
    {
      "id": "fail-loop",
      "check": "In fail/'s journal one item runs brief, build 1 (injected, marked so in the report), verify FAIL at build 1's head with at least one line FAIL, build 2 whose context.md and stage.json show that verify's output as its verdict input and build 1's PR as previous, verify PASS at build 2's head on the same PR, the merge card tapped approve, merged in the fake GitHub, item done",
      "how": "The verifier reads fail/journal and run/gh-state.json and replays the rows itself",
      "proof": "world"
    },
    {
      "id": "blocked-route",
      "check": "In blocked/'s journal the build run's accepted result is blocked with a reason naming the refused push, the item is at replanning, and the replanning card's input carries failure 'build blocked: <that reason>'; run/ holds the origin's refusal text as the builder saw it",
      "how": "The verifier reads blocked/journal and run/",
      "proof": "world"
    },
    {
      "id": "real-agents",
      "check": "Every run except fail's build 1 was answered by a real model agent given exactly its run/pending prompt, which equals the run's brief.md plus context.md plus only the one-line trial note; the injected build 1 answer and diff are in run/ and miss exactly the line the report names",
      "how": "The verifier's own script diffing run/pending against each run's brief.md and context.md, and reading the injected diff",
      "proof": "verifier"
    },
    {
      "id": "refusals-counted",
      "check": "Each report's refusals-by-rule table equals the refused accept rows in its journal and driver log, and each report says per run whether the agent needed anything beyond its prompt",
      "how": "The verifier's own count over both journals",
      "proof": "verifier"
    },
    {
      "id": "stage-record",
      "check": "stage.json exists for every model run in both journals and its prompt parts reassemble to brief.md byte for byte",
      "how": "The verifier's own script calling assemble() from packages/engine/src/stages.js",
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
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No engine or workflow change: a defect the trials find becomes a draft item in the replan that closes this one",
    "No second-fail trial: verify FAIL twice reaching replanning stays covered by scenario Q4 and C-second-fail-replans",
    "No real GitHub: both trials use the adopt trial's fake GitHub and local origin, as trial 2 and adopt did"
  ],
  "records": [
    "Each trial's journal: engine rows, accept and refusal rows, runs/<n>.<actor>/stage.json",
    "run/driver-log.jsonl with every hand-off, answer and CI run"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 3000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The injected build 1 is not a model: the FAIL route's real agents are verify 1, build 2 and verify 2. A first build a real model gets wrong on its own would be stronger evidence, but three trials show the brief writer defuses traps it can see.",
    "A real builder refused a push may work around it (drop the workflow change and open a partial PR). Then the item goes to FAIL rather than blocked; the report says so and the blocked route stays unproven.",
    "N3: agents spawned here inherit this session's ambient instructions, as in trial 2 and adopt."
  ]
}
```

## What this is

Three real-model trials of the stage contract (trial 1, trial 2, adopt) all merged on the first build, so two routes
of quick-fix have only been taken by scenario tests: verify FAIL followed by a rebuild that receives the verdict, and
a build that returns blocked and stops for replanning. This probe takes each route once with real agents on main's
engine, using the adopt trial's driver, and reports whether the stage prompts alone carried the agents through.

How each trial is forced onto its route is decided in plan/decisions/2026-11-05-trial-fail-path.md. Fail's first build
is injected (a recorded build that meets every line but one), because in the adopt trial the brief writer read the repo
and told the builder about the planted trap. Blocked's origin refuses any push that changes .github/workflows/ with
GitHub's own workflow-scope message, which only the builder meets.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read this item, the decision
plan/decisions/2026-11-05-trial-fail-path.md and both reports, then check the trials from their committed files, not
from the reports: write your own scripts under `verify/trial-fail-path/`. For fail-loop and blocked-route, replay
each journal's rows and runs and read run/gh-state.json; confirm build 2's verdict input is the FAIL verify's accepted
result and that the merge happened at verify 2's head. For real-agents, diff each run/pending prompt against its run's
brief.md and context.md and name every extra line. For refusals-counted, count refused accept rows by rule in each
journal and driver log and compare with the tables. For stage-record, reassemble every stage.json with assemble(). You
may rerun a driver in a temp TRIAL_DIR up to its first hand-off to see it start. Read the ci check at the head sha.
Commit `verify/trial-fail-path/verdict.json` with a verdict per Expect id.

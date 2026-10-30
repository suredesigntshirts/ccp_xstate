```json
{
  "id": "obs-time-and-rework",
  "title": "Show where wall-clock time goes, how much is rework, and what the harness costs itself",
  "stage": "s4b-widen",
  "kind": "build",
  "status": "draft",
  "outcome": "Derived views over the journal answer: time working versus waiting (on the person, CI, a wake, a rebuild); rounds, red CI pushes and replans per PR; and tokens spent on harness work against product work. A tripwire row fires when a PR passes its round limit.",
  "why": "PR #72 ran five rounds before the person noticed, and much of v1's effort went into its own bookkeeping without anyone seeing the ratio.",
  "serves": [
    "L-rework-invisible",
    "L-harness-overhead",
    "L-attention-is-the-constraint",
    "L-measure-then-park"
  ],
  "depends_on": [
    "obs-live-capture",
    "obs-person-attention",
    "retro-first-item"
  ],
  "inputs": [
    {
      "ref": "Journal rows from obs-live-capture and obs-person-attention",
      "what": "Calls, waits, usage"
    },
    {
      "ref": "GitHub REST (PR commits, check runs)",
      "what": "Pushes and CI results per PR, as ci.result rows"
    }
  ],
  "outputs": [
    {
      "ref": "packages/journal/src/derive/time.js, rework.js, overhead.js",
      "what": "Pure functions over rows; each output names its inputs"
    },
    {
      "ref": "tripwire row",
      "what": "{pr, rounds, limit} when a PR's rounds exceed the limit its item set (default 2)"
    }
  ],
  "expect": [
    {
      "id": "time",
      "check": "For a fixture day, working plus each waiting kind sums to wall-clock time, with nothing unclassified over 5%",
      "how": "Unit test on a fixture built from a real session"
    },
    {
      "id": "rework",
      "check": "A fixture PR with 3 pushes and 2 red CI runs reports 3 rounds and 2 red, and emits one tripwire at limit 2",
      "how": "Unit test"
    },
    {
      "id": "overhead",
      "check": "Work in this repo's plugins/ and packages/ counts as harness; other repos as product; the split is configurable",
      "how": "Unit test with both"
    }
  ],
  "cases": [
    "C-second-fail-replans"
  ],
  "concepts": {
    "adds": [
      "derived view",
      "tripwire"
    ],
    "budget": 2
  },
  "non_goals": [
    "The tripwire only records; acting on it is the engine's job in stage 3"
  ],
  "records": [
    "ci.result",
    "tripwire"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 2000000
  },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": [
    "Classifying waits needs the wake reason; if a wake lacks one, the time is labelled unknown, never guessed"
  ]
}
```

## Verifier brief

Run the tests. Build one fixture yourself from a real PR in this repo (its pushes and check runs from GitHub REST) and
compare the derived rounds with what GitHub shows. Verdict per Expect id.

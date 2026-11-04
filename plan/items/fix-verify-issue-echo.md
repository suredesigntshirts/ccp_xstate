```json
{
  "id": "fix-verify-issue-echo",
  "title": "Stop refusing a verdict that trims the issue it restates",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "A verify result whose issue carries the input issue's url and expect exactly is accepted whether or not it repeats the title and body, so the Schema and the restated rule agree and a real verifier is not refused for following the Schema; any key a restated field does carry must still equal the input's exactly.",
  "why": "In the engine-stage-contract adopt trial (tournaments/2026-11-04-stage-contract/trials/adopt/report.md) the real verifier's first return was refused by rule restated: its issue held only url and expect, the two keys the verify Schema marks required, and dropped title and body, which the input had. The Output text says to copy the issue byte for byte, but the Schema reads as permission to send less. Trial 2 had already named this echo as the most fragile field (N5). The first decision, narrow the comparison rather than widen the Schema, is recorded in plan/decisions/2026-11-04-verify-issue-echo.md: the echo exists so the verdict carries the lines it graded, and title and body are never graded.",
  "serves": [
    "L-refusals-unmeasured",
    "L-agents-self-report"
  ],
  "depends_on": [
    "engine-stage-contract"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/actors.js accept()",
      "what": "The restated rule: today every top-level result key the input also has must JSON.stringify-equal the input's value, which also makes key order matter"
    },
    {
      "ref": "workflows/quick-fix.json and workflows/research.json, verify actor",
      "what": "The output Schema for issue ($ref #issue, required url and expect) and its description, which tells the agent to copy every key in the same order"
    },
    {
      "ref": "tournaments/2026-11-04-stage-contract/trials/adopt/",
      "what": "The refused return and the accepted retry, as evidence of the shape a real verifier sends"
    },
    {
      "ref": "packages/engine/test/tourney/Q9.test.js",
      "what": "The scenario that must keep refusing a verifier that grades edited expect lines"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js",
      "what": "restated compares what the result carries: a restated object may leave out keys, and every key it carries must equal the input's exactly at any depth; arrays and other values compare exactly"
    },
    {
      "ref": "workflows/quick-fix.json, workflows/research.json",
      "what": "The verify issue description says what the host compares: url and expect copied exactly, title and body may be left out, anything included must equal the input"
    },
    {
      "ref": "packages/engine/test/",
      "what": "Tests of the trimmed echo accepted and of each tampered echo refused"
    },
    {
      "ref": "docs/journal.md or the engine doc that names accept's rules",
      "what": "The restated rule as it now reads, if a doc states it"
    }
  ],
  "expect": [
    {
      "id": "trimmed-accepted",
      "check": "Through the real engine's accept(), a verify result whose issue is { url, expect } equal to an input issue that also has title and body is accepted, and so is the full four-key echo in a different key order",
      "how": "The verifier's own test calling accept() on a prepared quick-fix verify run",
      "proof": "verifier"
    },
    {
      "id": "tamper-refused",
      "check": "The same run refuses, each as rule restated, an issue with one expect line changed, with an expect line dropped, with the url changed, with a title that differs from the input's, and with a key the input issue does not have",
      "how": "The verifier's own test calling accept()",
      "proof": "verifier"
    },
    {
      "id": "prompt-agrees",
      "check": "The verify Output part of brief.md for quick-fix and research no longer asks for the same keys in the same order, and says url and expect must be copied exactly and title and body may be left out",
      "how": "The verifier reads brief.md and stage.json from a scenario run folder made on the head",
      "proof": "verifier"
    },
    {
      "id": "scenarios",
      "check": "Every tourney scenario test passes, Q9 still refuses the drifted verdict as restated, and no existing scenario assertion is weakened",
      "how": "node --test packages/engine/test/tourney/*.test.js and the diff of those files",
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
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No per-run Schema built from the input's keys (the option the decision rejects)",
    "No change to the covers rule, the pr echo, or any other accept rule",
    "No real-model trial; trial-fail-path runs the next one"
  ],
  "records": [
    "accept refusals of rule restated, journalled as today"
  ],
  "step_back": {
    "max_rounds": 3,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "Workflow text changes the workflows' sha256, so an item pinned to the old quick-fix keeps the old Output text (and the new rule) until it finishes; this is by design of the pin."
  ]
}
```

## What this is

The verify stage restates its input issue so the verdict carries the exact lines it graded. The host checks that
restatement with rule `restated`. The Schema asks for `url` and `expect`; the rule demanded every input key, in
order. A real verifier followed the Schema and was refused. This item makes the rule check what the result carries,
and makes the Output text say so.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under
`verify/fix-verify-issue-echo/` that start a quick-fix item on the real engine (the tourney world in
`packages/engine/test/tourney/world.js` is fine to reuse) with an input issue that has `url`, `title`, `body` and
`expect`, drive it to verifying, and call `accept()` for the verify run. For trimmed-accepted, return `{ url, expect }`
copied exactly and confirm it is accepted; in a fresh item, return all four keys in a different order and confirm it
is accepted. For tamper-refused, confirm each of these is refused with rule `restated`: one expect line with a word
changed, one expect line dropped, the url changed, a title that differs, and an extra key such as `labels`. For
prompt-agrees, run the tourney tests with `TMPDIR` set to a fresh directory, open a verify run's `brief.md` and
`stage.json` for quick-fix, and read the research workflow's verify description, and confirm the wording. For
scenarios, run `node --test packages/engine/test/tourney/*.test.js` and read the diff of those files against main.
Read the ci check at the head sha. Commit `verify/fix-verify-issue-echo/verdict.json` with a verdict per Expect id.

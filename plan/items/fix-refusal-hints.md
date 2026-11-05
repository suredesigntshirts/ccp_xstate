```json
{
  "id": "fix-refusal-hints",
  "title": "Make each return refusal say how to fix it",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "Every refusal of a stage's return names the field, what was wrong, and that field's own description from the stage's output (the fix in plain words); a restated refusal names the key that differs, with the input's value and the returned value; and refusals per run are capped by the engine, after which the run fails with the refusals as its reason.",
  "why": "The person asked on 5 Nov how good the refusal messages are. They name the field and the broken rule, for example `result.pr.at does not match ^[0-9a-f]{40}$`, but not the fix the prompt already states for that field, and the restated refusal does not say which key differs. The only real-run refusal so far (the adopt trial's verify, restated) was fixed on the second try, so the messages work, but they lean on the agent re-reading its prompt. Today there is no cap on refusals per run, so an agent that cannot comply loops until it gives up. How each part is shaped is decided in plan/decisions/2026-11-05-refusal-hints.md.",
  "serves": [
    "L-refusals-unmeasured",
    "L-handback-without-return"
  ],
  "depends_on": [
    "engine-stage-contract"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/actors.js accept",
      "what": "The checks a return passes in order (unknown-run, wrong-caller, already-returned, already-failed, schema, reserved, restated, covers, ref) and the refusal row each journals; a refusal is { rule, reason }"
    },
    {
      "ref": "packages/engine/src/actors.js agrees, fail, resultsOf",
      "what": "The restated comparison; how a stopped run fails (failed.json, a no-return refusal row) and becomes the invoke's error event"
    },
    {
      "ref": "packages/engine/src/schema.js check",
      "what": "Schema problems as `$.<path> <what>` strings"
    },
    {
      "ref": "packages/engine/src/prompts.js, packages/engine/src/stages.js sections",
      "what": "A stage file's ## Output line for each top-level output field becomes that property's description in the run's schema, printed under Output"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs",
      "what": "The PreToolUse hook of the return tool: deny(`${rule}: ${reason}`), and deliver on accept; deliverFailed for a stopped run"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js accept",
      "what": "A refusal for a result rule (schema, reserved, restated, covers, ref) is { rule, reason, hint, count, cap }: hint holds, once per top-level output field the reason names, `<field>: <that field's description>` verbatim from the run's schema; a restated reason names every key path that differs, each with the returned value and the input's value (JSON, each cut to 200 characters); the refusal row's payload carries hint, count and cap. The refusal that makes the count reach REFUSAL_CAP (8) also fails the run: failed.json holds why, `refused <cap> times`, with each refusal's rule and reason, a no-return-style refusal row with rule refusal-cap is journalled, and accept returns { refused, failed: run }"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs",
      "what": "The deny text is `<rule>: <reason>`, then `How to fix it, from your Output:` and the hint lines, then `Refusal <count> of <cap>.`; at the cap it says the run has failed and the agent must not call the return tool again, and the hook delivers the failed run to its item"
    },
    {
      "ref": "packages/engine/test/actors.test.js (or a new packages/engine/test/refusals.test.js)",
      "what": "The builder's tests of the hint, the restated diff and the cap"
    },
    {
      "ref": "packages/engine/README.md, docs/journal.md",
      "what": "The refusal's hint, count and cap, and the refusal-cap failure, where these describe refusals"
    }
  ],
  "expect": [
    {
      "id": "hint",
      "check": "Through the real accept() on a run prepared from workflows/quick-fix.json, a verify result with pr.at a short sha is refused with rule schema, its reason unchanged from main's (`verify result: result.pr.at does not match ^[0-9a-f]{40}$`), and its hint is `pr: ` followed by the pr line of workflows/quick-fix/verify.md's ## Output word for word; a result wrong in two fields (pr.at and a missing lines) has one hint line for each of pr and lines and none for others; a build result with pr.url prose gets the build stage's pr line; a covers refusal (an expect line left out of lines) has the lines hint",
      "how": "The verifier's own test, comparing the hint with the stage file's text",
      "proof": "verifier"
    },
    {
      "id": "restated",
      "check": "A verify result whose issue changes one expect line is refused with rule restated, and the reason names result.issue.expect[<i>] with the returned line and the input's line; one that adds a key names that key as not in the input; one that changes both url and a line names both paths; values over 200 characters are cut; the exact echo is then accepted",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "cap",
      "check": "The same bad result returned 7 times is refused 7 times with count 1 to 7 and cap 8 and the run stays open; the 8th is refused with count 8 and fails the run: failed.json's why starts `refused 8 times` and lists every refusal's rule and reason, a refusal-cap row is journalled, a 9th return is refused already-failed, and the item, offered resultsOf, takes the invoke's error (quick-fix verifying goes to its onError target); wrong-caller, unknown-run and already-returned refusals do not count; a run refused 7 times then accepted is accepted",
      "how": "The verifier's own test on the real engine",
      "proof": "verifier"
    },
    {
      "id": "unchanged",
      "check": "No prompt text changes: render() of every stage of every workflow in workflows/ is byte for byte main's, and every workflow's hash is main's; every engine, plugin and verify test that passes on main passes, and any assertion changed in packages/ or plugins/ tests reads only the new hint, count, cap or restated wording",
      "how": "node --test over packages/, plugins/ and verify/, and the diff of the tests against main",
      "proof": "verifier"
    },
    {
      "id": "real-agent",
      "check": "In a real Claude Code session with the PR's harness plugin loaded (a thread, or claude -p with --plugin-dir), a real model agent started for a prepared run, told by its task to first return a result with pr.at shortened to 7 characters and then fix it from the refusal alone, gets a deny whose text has the pr hint and `Refusal 1 of 8.`, and its next return is accepted; a second run whose agent is told to return the same bad result until told to stop ends with the run failed at the 8th refusal, the deny saying so, and the item past its onError",
      "how": "The verifier's own run, with the item's journal rows and the agent's transcript read after",
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
    "adds": [
      "refusal cap"
    ],
    "budget": 1
  },
  "non_goals": [
    "No prompt change: returnLine and the stage files stay as they are, so no bench rerun and no workflow hash change",
    "No hint for nested fields beyond their top-level field: only top-level output fields have descriptions",
    "No cap on wrong-caller or other refusals that are not about the result, so another agent cannot use up a run's refusals",
    "No change to which checks run or in what order"
  ],
  "records": [
    "refusal rows for result rules carry hint, count and cap",
    "a refusal row with rule refusal-cap when a run fails at the cap, and the run's failed.json"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A cap too low fails a run that would have succeeded; 8 is above the most sequential fixes a result can need (decision), and the count is in every row so a real run near the cap shows",
    "A long description makes a long deny; descriptions are one line each and only the named fields are given",
    "Done verifier tests that make many refusals on one run would hit the cap; fix-verify-issue-echo's tamper test makes 7 on one run, under the cap"
  ]
}
```

## What this is

Today a refused return says what rule broke and where, and the agent has to go back to its prompt for how to fix it.
This item puts the fix next to the fault: each field the refusal names comes with that field's own Output line, a
restated refusal says which key differs and how, and a run refused eight times fails instead of looping, so the item
takes its error path and steps back.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read the decision
plan/decisions/2026-11-05-refusal-hints.md, and write your own tests under `verify/fix-refusal-hints/` without reading
the builder's. Prepare runs on the real engine from workflows/quick-fix.json (the parity world in
packages/engine/test/parity/world.js or verify/fix-verify-issue-echo/echo.test.mjs show how to reach verifying with a
bound agent and a stub GitHub), and call `accept()` directly. For hint, compare each hint line with the stage file's
## Output line read from workflows/quick-fix/<stage>.md yourself. For restated, tamper the issue as the expect line
says. For cap, return one bad result repeatedly, read failed.json and the item's rows, then offer `resultsOf(host)`
and check the state; also check that refusals of rule wrong-caller do not count. For unchanged, render every stage of
every workflow at the head and at main and compare, compare hashes, run `npm test`, and read the diff of the tests
against main. For real-agent, run a real Claude Code session with the PR's plugins/harness loaded (headless `claude -p
--plugin-dir` in your own container is fine; the stage-bench and probe-plugin-agents verifiers show how), prepare a
run with a task that tells the agent what to return, let the agent call the real return tool, and read the deny text
from its transcript and the rows from the journal. Break the hint (return an empty hint) and the cap (never fail) and
show a builder test going red for each. Read the ci check at the head sha. Commit
`verify/fix-refusal-hints/verdict.json` with a verdict per Expect id.

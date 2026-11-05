```json
{
  "id": "fix-return-tool-answer",
  "title": "Make the return tool confirm a result the hook accepted",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "After the harness hook accepts a return, the return tool answers accepted for that same call, including a result whose PR refs the host stamped, so no agent retries an accepted result into already-returned.",
  "why": "fix-refusal-hints' verifier saw it in a real run (plan/decisions/2026-11-05-refusal-hints.md, After the build). result.json's hash is of the stamped result (key, branch, checkout and green added to each PR ref), but plugins/harness/scripts/return-tool.mjs hashes the result the agent sent, so every accepted return with a PR ref gets 'not accepted: no harness check passed this result', and the agent retries into already-returned. Main does the same. How the tool recognises the accepted call is decided in plan/decisions/2026-11-05-return-tool-answer.md.",
  "serves": [
    "L-refusals-unmeasured"
  ],
  "depends_on": [
    "fix-refusal-hints"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/actors.js accept",
      "what": "Writes result.json { result: stamped, hash, caller, toolUseId, at } once every check passes; hash is sha256 of JSON.stringify(stamped)"
    },
    {
      "ref": "plugins/harness/scripts/return-tool.mjs answer",
      "what": "Answers accepted only when result.json's hash equals sha256(JSON.stringify(arguments.result)); imports no engine code"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs",
      "what": "The return tool's PreToolUse hook: passes tool_input.result to accept() unchanged and denies a refused call, so the server only sees calls the hook let through"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js accept",
      "what": "result.json also holds sent: sha256 of the result as the agent sent it, serialised with object keys sorted at every depth; everything else in result.json, the blob and the result.stored row are unchanged"
    },
    {
      "ref": "plugins/harness/scripts/return-tool.mjs answer",
      "what": "Answers accepted when the arguments' sorted-key hash equals result.json's sent, or, when result.json has no sent (results stored before this change), their plain hash equals its hash; not accepted otherwise, with the same texts as today"
    },
    {
      "ref": "plugins/harness/test/actors.test.mjs (or a new test beside it)",
      "what": "The builder's test: a return with a PR ref accepted by the hook, then answered accepted by the server; a changed result answered not accepted"
    },
    {
      "ref": "docs/journal.md, plugins/harness/README.md",
      "what": "result.json's sent, where these describe result.json or the return tool"
    }
  ],
  "expect": [
    {
      "id": "stamped-accepted",
      "check": "Through the real hook (plugins/harness/scripts/actors.mjs) and the real return-tool server over stdio, on a run prepared from workflows/quick-fix.json at a stage whose result carries a PR ref (build or verify) with a stub GitHub showing the PR at the worktree's head: the hook accepts the return, result.json's result has the stamped key, branch and checkout, and the server answers the same arguments with text starting `accepted: `; on main the same steps answer `not accepted`",
      "how": "The verifier's own test, run at the head and at main",
      "proof": "verifier"
    },
    {
      "id": "still-refuses",
      "check": "For that accepted run, the server answers not accepted to a result that differs in any one value (pr.at, a lines entry), to a result that adds the stamped key itself, and to a run whose result.json is absent; a result.json holding only result and hash (as written before this change, and as verify/engine-actors writes it) is still accepted for exactly that result",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "key-order",
      "check": "The same result with its object keys in another order at any depth is answered accepted when result.json was written by accept() for the first order",
      "how": "The verifier's own test",
      "proof": "verifier"
    },
    {
      "id": "unchanged",
      "check": "No prompt or check changes: render() of every stage of every workflow is byte for byte main's and every workflow hash is main's; accept() returns, refusal rows and result.stored rows are main's for the same inputs; every engine, plugin and verify test that passes on main passes, except verify/fix-refusal-hints/real-agent.test.mjs's advisory assertion if it reads a live answer (it reads committed evidence, so it should pass unchanged)",
      "how": "node --test over packages/, plugins/ and verify/, and the diff against main",
      "proof": "verifier"
    },
    {
      "id": "real-agent",
      "check": "In a real Claude Code session with the PR's harness plugin loaded (claude -p --plugin-dir, as fix-refusal-hints' verifier did), a real build agent for a prepared quick-fix run returns a result with a PR ref that the hook accepts, and the tool result in its transcript starts `accepted: `; the agent makes no further return call for that run and the item journal has one result.stored and no already-returned refusal for it",
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
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No use of a tool use id in the MCP call: no probe has shown Claude Code sends one",
    "No change to which checks run, their order, the stored result or any refusal text",
    "No prompt change, so no bench rerun and no workflow hash change"
  ],
  "records": [
    "result.json's sent hash beside its hash"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "If the hook's tool_input and the server's arguments ever differ in more than key order (numbers reformatted, for example), sent would not match; the real-agent line is there to catch that",
    "A done verifier test that writes result.json by hand still passes because the plain hash match stays"
  ]
}
```

## What this is

The return tool tells an agent whether its result counted. Today it says "not accepted" to every result with a PR in
it, even after the hook accepted it, because the host adds fields to the PR before storing it and the tool compares
against the stored version. The agent then tries again and is refused already-returned. This item makes the tool
compare against what the agent sent, which accept() now keeps beside the stamped hash.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read the decision
plan/decisions/2026-11-05-return-tool-answer.md, and write your own tests under `verify/fix-return-tool-answer/`
without reading the builder's. Prepare a quick-fix run on the real engine that reaches build or verify with a bound
agent and a stub GitHub (packages/engine/test/parity/world.js, verify/fix-verify-issue-echo/echo.test.mjs and
plugins/harness/test/actors.test.mjs show how), send the return through the real hook script, then run the real
return-tool server over stdio with the same arguments and read its answer. Run the same steps at main and show the
answer differs. For still-refuses, change one value at a time, and hand-write a result.json holding only result and
hash. For key-order, reorder keys at every depth. For unchanged, render every stage of every workflow at the head and
at main, compare hashes, compare accept()'s returns and rows for the same inputs, run `npm test`, and read the diff.
For real-agent, run a real Claude Code session with the PR's plugins/harness loaded (headless `claude -p
--plugin-dir` in your own container, as verify/fix-refusal-hints/ did, with a stub GitHub that shows the PR at the
worktree's head), let a real build agent return a PR ref, and read the tool result from its transcript and the rows
from the journal. Break the fix (drop `sent` from result.json) and show a builder test going red. Read the ci check at
the head sha. Commit `verify/fix-return-tool-answer/verdict.json` with a verdict per Expect id.

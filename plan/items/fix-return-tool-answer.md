```json
{
  "id": "fix-return-tool-answer",
  "title": "Make the return tool confirm a result the hook accepted",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "After the harness hook accepts a return, the return tool answers accepted for that same call, including a result whose PR refs the host stamped, so no agent retries an accepted result into already-returned.",
  "why": "fix-refusal-hints' verifier saw it in a real run (plan/decisions/2026-11-05-refusal-hints.md, After the build). result.json's hash is of the stamped result (key, branch, checkout and green added to each PR ref), but plugins/harness/scripts/return-tool.mjs hashes the result the agent sent, so every accepted return with a PR ref gets 'not accepted: no harness check passed this result', and the agent retries into already-returned. Main does the same.",
  "serves": [
    "L-refusals-unmeasured"
  ],
  "depends_on": [
    "fix-refusal-hints"
  ]
}
```

## What this is

Draft. A replan to ready decides how the tool recognises the accepted call: by the tool use id the hook stored in
result.json, or by a hash of the unstamped result kept beside the stamped one.

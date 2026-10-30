```json
{
  "id": "engine-actors",
  "title": "Start builders and verifiers as invoked actors and accept only checked results",
  "stage": "s3-engine-skeleton",
  "kind": "build",
  "status": "ready",
  "outcome": "When a workflow state invokes an actor, the host writes its brief, spawns it, records its agent id, and accepts its result only through a return tool that checks the caller, the output schema and the facts on GitHub.",
  "why": "Completions from the actor the machine started can't be forged. Mods don't enforce tool schemas and show registered tools to every subagent (v1 probe), so the host checks both caller and schema itself, and confirms a claimed PR against GitHub.",
  "serves": [
    "L-agents-self-report",
    "L-bind-by-guess",
    "L-briefs-durable",
    "L-facts-from-source",
    "L-mods-capabilities",
    "L-mods-never-store-dollar",
    "L-no-checks-the-builder-writes",
    "L-no-trust-boundary",
    "L-same-account-everywhere",
    "L-scratch-names-carry-item",
    "L-threads-cannot-start-threads",
    "L-verifier-independent",
    "L-walking-skeleton-control-first"
  ],
  "depends_on": [
    "engine-host"
  ],
  "inputs": [
    {
      "ref": "PR #110 src/flows.js and plugins/orchestrator/hooks/host.js",
      "what": "Spawn, prepare, session, finish split"
    },
    {
      "ref": "plan/research/platform-baseline.md",
      "what": "$.agent.spawn behaviour on idle wakes"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/actors.js",
      "what": "invoke(actorSpec, input) -> agentId; return tool mcp__harness__return accepting calls only from that agentId"
    },
    {
      "ref": "Per-actor folders under the item",
      "what": "Brief, scratch space and result, named by item and run"
    }
  ],
  "expect": [
    {
      "id": "fixed-before-build",
      "check": "The verifier brief's hash is in context before the builder is invoked",
      "how": "Test reads context at the building state"
    },
    {
      "id": "wrong-caller",
      "check": "A return call from any other agent is refused and journalled",
      "how": "Test"
    },
    {
      "id": "schema",
      "check": "A result missing a required field is refused, naming it",
      "how": "Test"
    },
    {
      "id": "github-fact",
      "check": "A claimed PR that GitHub doesn't show at that head is refused and the item stays in building",
      "how": "Test for case C-claimed-pr-not-on-github with a GitHub stub"
    },
    {
      "id": "own-folder",
      "check": "Each actor works in its own worktree or folder named by item and run, even though $.agent.spawn ignores cwd",
      "how": "Test: two actors' briefs name different folders, and the brief tells the actor to cd first"
    }
  ],
  "cases": [
    "C-claimed-pr-not-on-github"
  ],
  "concepts": {
    "adds": [
      "return tool"
    ],
    "budget": 1
  },
  "non_goals": [
    "No thread-based actors yet; subagents only, unless the probe rules them out"
  ],
  "records": [
    "agent.spawn with item and state",
    "result.stored",
    "refusal for refused returns"
  ],
  "person_prereqs": [
    "Allow rule for the host spawning builder and verifier subagents, placed before the thread starts"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 3000000
  },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": [
    "If idle-wake spawns stay refused, actors start from a thread turn the wake prompts; the return-tool checks stay the same"
  ]
}
```

## Verifier brief

Run the tests. Then, in a headless session with the plugin, invoke a toy builder whose brief tells it to call the
return tool with a made-up PR. Confirm the refusal names the GitHub fact. Verdict per Expect id.

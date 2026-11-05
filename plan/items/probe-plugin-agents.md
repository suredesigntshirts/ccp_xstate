```json
{
  "id": "probe-plugin-agents",
  "title": "Find out whether agents shipped in the harness plugin load in real cloud threads",
  "stage": "s5-parity",
  "kind": "probe",
  "status": "ready",
  "outcome": "A released ccp-harness version ships one test agent in its agents/ folder, and a fresh cloud thread on that release shows whether the agent is listed and callable by its namespaced name, whether its tools, model and system prompt hold, and whether the harness's prompt swap and SubagentStart binding still work with a named agent; the report says whether stage roles can live in the plugin.",
  "why": "On 5 Nov the person asked to keep our agents in the plugin, if spike tests show plugin agents deploy. Named agents would make Claude Code enforce a stage's tools and model, where today those are only rules in the prompt text. A first headless spike on 5 Nov, with claude -p --plugin-dir and a throwaway plugin, held on every point (results in plan/decisions/2026-11-05-plugin-agents-spike.md). What it cannot show is the real install path: a marketplace-installed plugin, loaded at session start, in a Projects thread. The stage-prompt-files decision on named agents stays open until this reports.",
  "serves": [
    "L-plugins-load-at-start",
    "L-repo-skills-dont-load",
    "L-facts-from-source"
  ],
  "depends_on": [
    "self-update-by-version"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-05-plugin-agents-spike.md",
      "what": "The headless spike: the plugin layout, the hooks, the commands and what each showed"
    },
    {
      "ref": "plugins/harness/",
      "what": "The plugin the test agent ships in, and its PreToolUse and SubagentStart hooks"
    },
    {
      "ref": "scripts/release/release.mjs",
      "what": "How a plugin change is released so new threads load it"
    }
  ],
  "outputs": [
    {
      "ref": "plugins/harness/agents/probe-reader.md",
      "what": "One test agent: tools Read and Glob, model haiku, and a body that makes its system prompt identifiable"
    },
    {
      "ref": "plan/research/probe-plugin-agents.md",
      "what": "The report: each check, the session and transcript it came from, and the verdict on keeping stage roles in the plugin"
    }
  ],
  "expect": [
    {
      "id": "listed",
      "check": "In a cloud container, with the plugin installed by infra/cloud-environment/setup.sh from the commit that ships the agent and a claude -p session started with no --plugin-dir (so it loads ccp-harness@skills-dir at session start, as a thread does), the Agent tool lists ccp-harness:probe-reader, and a call with that subagent_type starts it. A Projects thread on a release is follow-up item probe-plugin-agents-thread, because new threads resume a cached 0.1.17 container",
      "how": "The session's init line and the subagent's meta.json",
      "proof": "world"
    },
    {
      "id": "holds",
      "check": "The started agent has only Read and Glob (a Write attempt is unavailable to it), runs on the model its frontmatter names, and shows its body's marker word, which no task prompt gives it",
      "how": "The subagent transcript and the session's model usage",
      "proof": "world"
    },
    {
      "id": "harness-works",
      "check": "With subagent_type set, the harness's PreToolUse prompt swap gives the agent its prepared brief, and SubagentStart binds the agent to its run with agent_type recorded",
      "how": "The run folder's spawn.json and the agent.spawn journal row",
      "proof": "world"
    },
    {
      "id": "report",
      "check": "plan/research/probe-plugin-agents.md records each check with the session and evidence it came from, and states whether stage roles can live in the plugin and how a role's version ties to the workflow pin",
      "how": "The verifier reads the report against the transcripts",
      "proof": "verifier"
    }
  ],
  "concepts": {
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No stage uses a named agent yet: that is decided after this, in stage-prompt-files or its follow-up",
    "No change to the workflow pin"
  ],
  "records": [
    "the fresh thread's transcript and subagent meta.json",
    "the run folder of the swapped-prompt check"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 300000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

The second half of the plugin-agents spike. The first half ran headless on 5 Nov
(`plan/decisions/2026-11-05-plugin-agents-spike.md`). This half needs a release and a fresh thread, because a thread
loads plugins only when it starts.

## Verifier brief

Find the release that ships `plugins/harness/agents/probe-reader.md`, and the fresh thread's session that ran the
checks. Read that session's transcript and the subagent's `meta.json` under `~/.claude/projects/`, or the copies the
report commits. Confirm listed, holds and harness-works from them. Then read the report against them for report.
Commit `verify/probe-plugin-agents/verdict.json` with a verdict per Expect id.

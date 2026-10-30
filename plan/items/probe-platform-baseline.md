```json
{
  "id": "probe-platform-baseline",
  "title": "Measure what the platform allows in a fresh v2 project",
  "stage": "s0-environment",
  "kind": "probe",
  "status": "ready",
  "outcome": "A dated report states, for the Claude Code version the v2 project runs, which of v2's platform assumptions hold in a real Projects thread and which don't.",
  "why": "Every later stage leans on platform behaviour v1 saw only partly or in another project. The riskiest one, whether the host may spawn workers on a wake no person asked for, decides the host design. A one-hour probe is cheaper than building on a guess.",
  "serves": ["L-classifier-judges-the-request", "L-mods-capabilities", "L-plugins-load-at-start", "L-subagent-depth", "L-hook-time-budget", "L-rules-before-session", "L-graphql-blocked"],
  "depends_on": [],
  "inputs": [
    { "ref": "plan/ledger/platform.md", "what": "The assumptions to test and what v1 saw" },
    { "ref": "v1 Library: notes/mods-probe-2026-10-28/BRIEF-commit-probe.md (copied into this item's prose)", "what": "The probe mod v1 used" }
  ],
  "outputs": [
    { "ref": "plan/research/platform-baseline.md", "what": "One row per assumption: holds / doesn't / untested, with evidence and the Claude Code version" },
    { "ref": "probes/platform/ (throwaway mod and scripts)", "what": "The probe code, so it can be rerun on a new Claude Code version" }
  ],
  "expect": [
    { "id": "versions", "check": "The report names the Claude Code version, the model served and the date", "how": "Read the report's header" },
    { "id": "idle-spawn", "check": "The report says whether a mod's $.agent.spawn runs on a send_later wake and on a GitHub PR event wake, each with no person message in that turn, under a pre-placed allow rule", "how": "Two journal lines from the probe mod per wake kind, with the spawned agent's answer or the refusal text" },
    { "id": "mcp-from-mod", "check": "The report says whether $.mcp.call reaches the project's thread tools (read_thread, request_decision, send_later) from a mod", "how": "The probe's logged call results" },
    { "id": "hooks-see-refusals", "check": "The report says how a classifier refusal shows up to hooks and to a mod (event name and fields), or that it doesn't", "how": "A deliberately refused harmless action and the probe's capture of it" },
    { "id": "depth-and-budgets", "check": "Subagent depth, the SessionStart and PreToolUse time budgets, and a mod hook's budget are measured", "how": "Probe output lines with the numbers" },
    { "id": "rerunnable", "check": "Running the probe again on a newer Claude Code needs one command", "how": "probes/platform/README.md names it; the verifier runs it and gets a report" }
  ],
  "cases": [],
  "concepts": { "adds": [], "budget": 0 },
  "non_goals": ["No harness code", "No fixes for anything that fails; failures become ledger rows and change later items", "Probe code isn't part of the plugin"],
  "records": ["Its own probe log; the journal doesn't exist yet"],
  "person_prereqs": [
    "Create the new Claude Project with only suredesigntshirts/ccp_xstate, and its own cloud environment",
    "Before the probe thread starts: in ccp_xstate main .claude/settings.json add the probe's autoMode.allow entries (listed in the prose), then save the setup script so the container rebuilds",
    "Start the probe thread with your words approving the probe mod spawning subagents"
  ],
  "step_back": { "max_rounds": 2, "max_tokens": 1500000, "replan_to": "person, with the report" },
  "verifier": "A separate subagent on a different model, using the Verifier brief below, which is fixed in this plan. It reruns the probe and compares its report with the builder's.",
  "risks": ["The setup script and allow rules have to exist before the probe can run, so the person installs them by hand this once"]
}
```

## Why first

v1's host design depended on a mod spawning workers when a wake arrives. On 28 Oct auto mode refused exactly that
on a scheduled wake, and allowed it only in a turn carrying the person's request. If that still holds under a
standing allow rule, the host can't be a mod reacting to wakes, and stage 3's design changes (fallback: the host is
a thread whose model spawns workers, prompted by the wake). Every other assumption here is cheaper to check in the
same run.

## Allow rules the person places first (plain words, for the probe only)

- "In the ccp_xstate project, the harness probe mod may start subagents with $.agent.spawn on any wake, including
  timer and GitHub event wakes, to test the platform. The project owner approved this on <date>."
- "Running `claude -p --plugin-dir probes/platform` for headless probe runs is allowed."

## Verifier brief

You check the platform-baseline report. Don't read the builder's reasoning. Run the probe yourself with the command
in `probes/platform/README.md`, then compare each row of your output with the report. A row passes only when your
run shows the same result. For the idle-spawn rows, confirm the wake carried no person message (read the wake's
reason). Write a verdict listing each Expect id as MET, NOT MET or UNCLEAR, with the evidence line.

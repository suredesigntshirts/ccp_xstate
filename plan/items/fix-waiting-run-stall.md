```json
{
  "id": "fix-waiting-run-stall",
  "title": "Keep the hosting thread from ending a turn while a run waits for its agent",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "When the hosting thread's Claude ends a turn while an actor run is prepared and has no agent, the harness's Stop hook blocks the stop with the exact Agent call to make, at most once per run, and the journal records each block and whether the agent then started.",
  "why": "Today the engine prepares a run, and a hook adds a line to the thread's context naming the Agent call to make, but nothing forces the call. A thread that ends its turn instead leaves the run waiting until something else wakes it. The person asked on 5 Nov what hooks could make the thread move more deterministically. Claude Code's Stop hook can block a stop with a reason that becomes the next instruction, and its stop_hook_active flag prevents loops. The harness registers a Stop hook already, but only for capture. Launching stages as headless processes, as the bench does, would remove the dependence on the thread entirely; that is weighed after the bench shows its cost (plan/decisions/2026-11-05-stage-prompt-files.md, follow-ups).",
  "serves": [
    "L-never-idle-on-person",
    "L-handback-without-return"
  ],
  "depends_on": [
    "engine-actors"
  ]
}
```

## What this is

Draft. A replan to ready settles how the hook finds the thread's own waiting runs (not another item's), what happens
in a Projects thread whose turn ends through a hearthbot tool, and how the real-run check proves a block led to a
spawn.

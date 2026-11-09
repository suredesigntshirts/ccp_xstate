```json
{
  "id": "memory-learnings-written",
  "title": "Write the learnings memory held into the repo",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "Every durable learning the memory audit harvested that code did not remove is in one home in the repo: container and GitHub traps in docs/traps.md, verifier techniques in docs/verifying.md, platform facts as rows in plan/ledger/platform.md; and a fresh session with memory off answers each harvested question from the repo alone.",
  "why": "The audit of 9 Nov found a few dozen durable traps, techniques and platform facts spread across memory logs, some only in decisions or research files a reader of the code never opens (L-cheap-home-wins, L-rules-live-in-the-repo).",
  "serves": [
    "L-cheap-home-wins",
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "own-traps-in-code"
  ],
  "inputs": [
    {
      "ref": "/mnt/project-files/memory-audit/report.md",
      "what": "Sections A, B and C"
    }
  ],
  "outputs": [
    {
      "ref": "docs/traps.md, docs/verifying.md, plan/ledger/platform.md",
      "what": "The entries"
    },
    {
      "ref": "test/",
      "what": "The harvested questions, kept as data the reader check reads"
    }
  ],
  "expect": [],
  "concepts": {
    "adds": [],
    "merges": [
      "memory's repeated notes, into one entry each"
    ],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No entry for a trap that no longer reproduces",
    "No rule change: rules stay in the entry texts"
  ],
  "records": [
    "The PR body maps each audit entry to its home or says why it was left out"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 700000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "An entry copied from memory may be stale: each is reproduced or checked against main before it is written"
  ]
}
```

## What this is

Draft, readied once own-traps-in-code is done, so entries point at its tools instead of describing workarounds.
From the audit: traps A4 (what auto mode and the git proxy refuse, and what works instead), A6 (no stash or checkout
while a background run uses the checkout), A7 (`/mnt/project-files` limits), A8 (CI events that never wake a thread,
a label added after opening, a stale `BASE_SHA`); techniques B2 (CLI shapes), B4 (commit transcript extracts, never
raw transcripts), B5 (base-side checks without history); platform facts C (prompt swap through `updatedInput`,
SubagentStart timing, named agents' tools, `--bare` and auto memory). The Expect lines include a world line that the PR's own notes-only part passes the verdict gate with no item once memory-boundary is merged (moved here from memory-boundary's contract change), and the reader check: each
harvested question answered from the repo by a session with memory off.

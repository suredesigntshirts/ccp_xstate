```json
{
  "id": "memory-learnings-written",
  "title": "Write the learnings memory held into the repo",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Every durable learning the memory audit harvested that code did not remove is in one home in the repo: container and GitHub traps in docs/traps.md, verifier techniques in docs/verifying.md, platform facts as rows in plan/ledger/platform.md, and each defect it found in a plan item; a guard under test/ holds the harvested questions with each one's home and carrying terms, and goes red when a home loses an answer; and a fresh reader with memory off answers each harvested question from the repo alone.",
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
      "what": "Sections 3 and 4: what is stale, and the A to D learnings with the files that repeat them"
    },
    {
      "ref": "plan/items/own-traps-in-code.md",
      "what": "The traps code removed, which get no entry"
    },
    {
      "ref": "docs/traps.md, docs/verifying.md, plan/ledger/platform.md",
      "what": "The homes and their entry shapes"
    }
  ],
  "outputs": [
    {
      "ref": "docs/traps.md, docs/verifying.md, plan/ledger/platform.md",
      "what": "The entries and rows"
    },
    {
      "ref": "plan/items/",
      "what": "The defects: a draft item for the derive.js bugs, and the small ones as lines in refine-leftovers"
    },
    {
      "ref": "test/",
      "what": "The harvested questions as data, and the guard that reads them against their homes"
    }
  ],
  "expect": [
    {
      "id": "traps-entries",
      "check": "docs/traps.md has an entry for each of: what auto mode and the git proxy refuse from a thread (force push, a rewrite of a pushed branch, branch delete, tag push) and what works instead; that the plugin tests install the working tree without its untracked files, so a new file is added to the index first; no stash, checkout or branch switch in a checkout a background run is using, and a worktree instead; /mnt/project-files refusing hard links and git worktrees; and the PR events that start no run or wake no thread, and a stale BASE_SHA",
      "how": "The verifier reads docs/traps.md for each entry's carrying terms",
      "proof": "verifier"
    },
    {
      "id": "verifying-entries",
      "check": "docs/verifying.md has an entry for each of: node --test-reporter without --test running only its first file, and claude -p's variadic --allowedTools swallowing a trailing prompt; committing extracts of transcripts, never raw ones, and why; and base-side checks without history (the base side's answers recorded by a script, a committed diff applied in a clone, temp repos built from copied plan/ and scripts/)",
      "how": "The verifier reads docs/verifying.md for each entry's carrying terms",
      "proof": "verifier"
    },
    {
      "id": "platform-rows",
      "check": "plan/ledger/platform.md has rows in the ledger's row format for: PreToolUse updatedInput replacing an Agent call's prompt (no permissionDecision in auto mode, allow under claude -p); SubagentStart running before the subagent's transcript exists, with Claude waiting for it; a named agent with a tools list getting no ToolSearch, and meta.json's pickedEffortModel being wrong for named agents; and claude -p --bare needing an API key, with CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 turning memory off; and node plan/check.mjs passes",
      "how": "The verifier reads the rows and runs the plan check",
      "proof": "verifier"
    },
    {
      "id": "still-true",
      "check": "Each entry that can be reproduced in a thread's container without a refused or outward action holds there: the reporter shape, the untracked file left out of git stash create, and the hard link refused on /mnt/project-files",
      "how": "The verifier reproduces each in a thread's container",
      "proof": "world"
    },
    {
      "id": "no-removed-traps",
      "check": "Neither docs/traps.md nor docs/verifying.md writes up a trap that code removed: a missing npm ci, NODE_TEST_CONTEXT, a typed verified_sha or copied trailer, or 'already released' read as an error",
      "how": "The verifier reads the two notes files for those terms",
      "proof": "verifier"
    },
    {
      "id": "defects-filed",
      "check": "Each defect in the audit's section D, and the observation that the nested-run guard reads test files only and not helper .mjs files, is named in a plan item: the derive.js attribution and counting bugs in an item of their own, the rest as lines in refine-leftovers; node plan/check.mjs passes",
      "how": "The verifier reads plan/items/ for each defect's carrying terms and runs the plan check",
      "proof": "verifier"
    },
    {
      "id": "questions-guard",
      "check": "A test under test/ reads a data file of the harvested questions, each with its home file and carrying terms, and fails naming the question when a home lacks a term; it is green on the PR's head and goes red when one entry's carrying term is removed from a copy of its home",
      "how": "The verifier runs the guard at the head and over a copy with one term removed",
      "proof": "verifier"
    },
    {
      "id": "reader-answers",
      "check": "A fresh reader started with scripts/fresh-reader.mjs in a clean clone of the head answers each question in the guard's data file with its home and carrying terms",
      "how": "The verifier runs the fresh reader on each question and matches the answer's carrying terms",
      "proof": "verifier"
    },
    {
      "id": "notes-only-world",
      "check": "On GitHub, a throwaway PR off main that names no item and changes only docs/traps.md passes the verdict gate",
      "how": "The verifier opens the throwaway PR, reads its gates check, and closes it",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
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
    "The PR body maps each audit entry in sections A to D to its home, or says why it was left out"
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

The audit's learnings, less what own-traps-in-code removed in code: A1 (npm ci), A2 and A3 (the fresh reader), A9
(already released), B1 (NODE_TEST_CONTEXT) and B3 (the verdict fields) get no entry. A5 is narrowed: the plugin
tests already install the uncommitted tree with `git stash create`, but that leaves out untracked files, so a new
file must be added to the index first (checked 9 Nov). The section 3 stale items get no entry either.

Each entry is checked against main or the container before it is written. The refusals in A4 and the events in A8
cannot be reproduced without the refused or outward action itself, so they are written from the repeated
observations and say so.

The harvested questions live as data beside a guard, so the answers cannot quietly leave their homes: the guard
matches carrying terms (`docs/layout.md`, Tests), and the fresh-reader run proves a reader finds them.

The notes-only world line was moved here from memory-boundary: it needs a PR after that merge.

## Verifier brief

Run the fresh reader with `node scripts/fresh-reader.mjs` from a clean clone of the head, after `npm ci`, one
question per run. For notes-only-world, branch off main, change one line of `docs/traps.md`, open the PR with no
`Item:` line, read the `gates` check, then close it and leave the branch for the person to delete.

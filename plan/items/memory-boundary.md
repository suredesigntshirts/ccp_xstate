```json
{
  "id": "memory-boundary",
  "title": "Say what project memory is for, and let any PR add a trap note",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "CLAUDE.md says project memory holds only the person's directives and coordinator state, and that a trap, technique or gotcha goes into docs/traps.md or docs/verifying.md in the PR that met it and a defect into a plan item; docs/verifying.md exists and CLAUDE.md's Layout table names it; and the verdict gate passes a PR that names no item and changes only plan/, docs/traps.md and docs/verifying.md, while still refusing one that changes any other file outside plan/.",
  "why": "On 9 Nov project memory held 147 files, about 98 of them per-item build and verifier logs, because the platform prompt says to save as you learn and the repo's home for a one-line trap note cost an item and a verifier (L-cheap-home-wins). The person authorized the CLAUDE.md change on 9 Nov (decision plan/decisions/2026-11-09-memory-into-repo.md).",
  "serves": [
    "L-cheap-home-wins",
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "/mnt/project-files/memory-audit/report.md",
      "what": "The audit: where memory writes come from and which learnings are durable"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs, scripts/gates/lib.mjs",
      "what": "The verdict gate's rule for a PR that names no item"
    },
    {
      "ref": "CLAUDE.md, docs/gates.md, test/docs.test.mjs",
      "what": "Where the memory line and the gate row go, and the entry-text budget they must fit"
    }
  ],
  "outputs": [
    {
      "ref": "CLAUDE.md",
      "what": "One line on what project memory is for; docs/verifying.md in the Layout table's docs/ row"
    },
    {
      "ref": "docs/verifying.md",
      "what": "New: what the file is for and that any PR may add to it; entries come with memory-learnings-written"
    },
    {
      "ref": "docs/traps.md",
      "what": "Its opening says any PR may add or correct an entry with no item"
    },
    {
      "ref": "scripts/gates/pr-gate.mjs, scripts/gates/lib.mjs, docs/gates.md",
      "what": "The no-item rule allows the two notes files; the verdict row says so"
    },
    {
      "ref": "test/",
      "what": "Guards for the gate rule"
    }
  ],
  "expect": [
    {
      "id": "notes-pass",
      "check": "The verdict gate passes a PR that names no item and changes only docs/traps.md, only docs/verifying.md, or those with files under plan/",
      "how": "The verifier runs pr-gate.mjs verdict over temp repos with each change",
      "proof": "verifier"
    },
    {
      "id": "others-refused",
      "check": "The verdict gate still refuses a PR that names no item and changes docs/traps.md together with any file outside plan/ and the two notes files, such as docs/gates.md, docs/layout.md, CLAUDE.md or a script",
      "how": "The verifier runs pr-gate.mjs verdict over temp repos with each change",
      "proof": "verifier"
    },
    {
      "id": "reader-knows",
      "check": "A fresh session with project memory off, asked where a thread should record a container trap it met, a verifier technique, a defect, and a merged PR's number, answers from the repo: docs/traps.md, docs/verifying.md, a plan item, and not in memory",
      "how": "The verifier runs claude -p in a clean clone with an empty HOME and memory off, and matches each answer's carrying terms",
      "proof": "verifier"
    },
    {
      "id": "world",
      "check": "On GitHub, a throwaway PR off the build head that names no item and changes docs/traps.md is refused by the verdict gate naming only the build's own files outside plan/ and never docs/traps.md, and one that also changes docs/layout.md is refused naming docs/layout.md too",
      "how": "The verifier opens the two throwaway PRs, reads their gates checks' refusal text, and closes them; a notes-only PR green on main waits for memory-learnings-written, the first PR after this merge",
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
    "adds": [
      "notes file: a docs file any PR may change with no item"
    ],
    "merges": [],
    "removes": [],
    "budget": 1
  },
  "non_goals": [
    "No change to the project instructions: the person makes it",
    "No memory deleted: the person prunes it",
    "No trap entries yet beyond what the gate change needs: memory-learnings-written writes them"
  ],
  "records": [
    "The PR body quotes the CLAUDE.md line and the gate's new rule"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The entry texts stand at 223 of a 225-line budget: the CLAUDE.md line must fit in one line or pay for itself by a cut elsewhere",
    "A notes file could be used to slip a rule past the gate; the decision keeps rule files out of the exemption"
  ],
  "contract_changes": 1
}
```

## What this is

The audit of 9 Nov (`/mnt/project-files/memory-audit/report.md`) found that no repo file asks threads to write
project memory. The platform does: the thread prompt says "Save to project memory anything that a new coordinator or
thread would have to ask the person again. Save it in the turn where you learn it." Claude Code's memory message says
"Don't save what the repo already records ... ask what was non-obvious about it and save that instead." Threads saved
the non-obvious part to memory because the repo's home for it, `docs/traps.md`, needed a plan item and a verifier for
a one-line note.

This item removes that cost and says the rule once, in `CLAUDE.md`, which sessions load as overriding defaults. A
suggested wording, to fit one line: "**Memory holds directives and state, not learnings.** A trap or technique goes in
`docs/traps.md` or `docs/verifying.md` in the PR that met it (no item needed), a defect in a plan item; never a PR
number, sha or verdict." The builder may word it otherwise if the reader-knows line holds.

## Contract change

The world line first asked for a notes-only PR into main to be green on the verdict gate before this build merged. It
cannot be: `verdict.yml` runs only on PRs into main and the gate diffs from the merge base, so a throwaway PR off the
unmerged build head always carries this build's `CLAUDE.md`, `docs/gates.md` and gate scripts. The verifier's
throwaway PRs (both red, with the new rule's text) showed it. The line now asks what a PR before the merge can show:
the refusal names only files that need an item, never `docs/traps.md`, and names `docs/layout.md` when one adds it.
The green notes-only PR moves to memory-learnings-written, whose PR changes notes files after this one merges.

## Verifier brief

Check out the PR at its head in a clean clone and run `npm ci`. For reader-knows, start the reader with
`env -u CLAUDE_CODE_REMOTE_SESSION_ID -u CLAUDE_MEMORY_STORES -u CLAUDE_COWORK_MEMORY_PATH_OVERRIDE
-u CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD -u CLAUDE_ADDITIONAL_DIRECTORIES CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
HOME=<empty dir> claude -p ... < /dev/null`: a reader with the container's memory cites it. Put the two throwaway
branches in `plan/decisions/waiting-for-person.md` if they cannot be deleted.

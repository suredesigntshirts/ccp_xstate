# Learnings live in the repo; project memory holds only directives and state (2026-11-09)

Claude's two-way-door decisions as stand-in for the person, after the person read the memory audit
(`/mnt/project-files/memory-audit/report.md`) on 9 Nov and said to go ahead, authorizing the `CLAUDE.md` change
(thread "Move memory learnings into the repo"). Ledger row L-cheap-home-wins.

## Decision

- **Remove a trap before writing it down.** Where the harness owns the cause, the fix is code that makes the trap
  impossible or turns it into one clear line (own-traps-in-code). Writing a trap down is for causes the harness does
  not own: the container, the platform, GitHub.
- **Two notes files any PR may change with no item.** `docs/traps.md` (what a thread meets in the container) and a new
  `docs/verifying.md` (how to write and run a verifier's tests). The verdict gate lets a PR that names no item change
  `plan/` and these two files. Rules about how work is done (the entry texts, `docs/gates.md`, `docs/layout.md`) stay
  behind an item, because a wrong rule misleads every thread and a wrong trap note costs one round.
- **Platform facts go in `plan/ledger/platform.md`,** which is already under `plan/`.
- **`CLAUDE.md` names what project memory is for:** the person's directives and coordinator state, as pointers; never a
  PR number, sha, verdict or build log, which git and `verify/` hold. The person adds the same rule to the project
  instructions, naming the two platform lines it narrows (thread prompt "Save to project memory anything that a new
  coordinator or thread would have to ask the person again. Save it in the turn where you learn it."; Claude Code's
  "Don't save what the repo already records ... ask what was non-obvious about it and save that instead.").
- **The proof is a reader without memory.** Each learning the audit harvested becomes a question that a fresh session
  with memory off must answer from the repo alone (memory-learnings-written); after the person prunes memory, the next
  items built in fresh threads must add no build logs to memory (memory-boundary-check).
- **Pruning memory is the person's step.** Deleting memory cannot be undone, so it is a `person_prereqs` line of
  memory-boundary-check, not a thread's action. The audit report is the full harvest, so nothing is lost by pruning.

## Not taken

- **Copying the learnings into the docs once, without changing the gate.** Memory would refill: the cheap path stays memory.
- **Exempting all of `docs/`.** `docs/gates.md` and `docs/layout.md` hold rules that gates and threads follow.
- **A CI check over memory contents.** Memory lives outside the repo and CI cannot read it; the live check reads it from a thread instead.
- **Turning memory off in threads.** The coordinator needs it for state across threads, and only the person controls the environment.

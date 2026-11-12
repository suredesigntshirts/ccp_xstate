# report

`node --test verify/memory-boundary-check/report.test.mjs` from a checkout of 32f515f9.

Passes: every listing in `plan/research/memory-boundary-check/` carries only name, size, sha-256 and entry id, its
`store_entries` equals its file count, and its report row names it with its session, sync time and entry count;
both observed items and their threads are named; five traps are named with homes that hold them; the delete-shape
fact is in the ledger.

Fails: the report does not name the `--release` trap from `plan/decisions/2026-11-11-second-workflow-run.md`, so it
does not name each trap with its home; and the draft-PR trap's home is on main but not on the branch.

Read by hand against my own listing: snapshot 3 is the last listing in the PR, taken 10:44:17Z, before PR 310 merged
(10:46:44Z) and before the coordinator's `MEMORY.md` edit stamped 10:48Z. My listing (`pruned.md`) covers that
window; the report should name it as the closing snapshot or say the verifier's listing closes it.

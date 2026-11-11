# selected

At 46c5a010c6af19b6f20b0a9a97377c3a3900cddb.

Real item: read (never written) `/mnt/project-files/harness/journal/items/second-workflow.jsonl`, its first row:
seq 0, applied, 2026-11-11T09:41:49.813Z, event xstate.init, source claude-code (the builder's session),
`payload.workflow` = `feature@b173324eb089f3c703a484fec5767a7a8c7b84fbe26381091a7b50c950425fca`, and
`payload.selection` = { workflow: the same id, by: "Sure Team, the person", how: "proposed running
derive-view-gaps through feature in the triage thread, 2026-11-11 06:45Z (plan/decisions/2026-11-11-v1-out-of-scope.md)" }.
Every later row of the item names the same workflow id; no later transition carries a selection.

Second start: `node --test verify/second-workflow/selected.test.mjs` (temp root per test, bin/host.js run as a child
process from a scratch git repo). 7 pass. A start with --selected-by/--how records { workflow: feature@<64 hex>, by, how };
with no --selected-by, by is "claude-code <session>" and how null; --how alone exits 2 and writes nothing; a blank
--selected-by is refused ("the selection names no one who picked the workflow"). A second start naming quick-fix,
feature again or research, with or without a new picker, and one from another session, applies nothing: one applied
row, every row on the first feature@ hash, selection.by still the first picker, state still planning.

The same suite at origin/main 5630fbd5 (copied into a worktree): 0 pass, 7 fail.

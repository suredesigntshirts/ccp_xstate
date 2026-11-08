# tests-bite

Head: 807999f1362281bc882f39a584bbd20935748762. Command: `node --test verify/done-with-the-build/tests-bite.test.mjs`. Each case copies scripts/ to a temp
folder, runs the test file under TAP, applies the mutation, runs it, restores, runs again.

1. scripts/gates/lib.mjs contractParts: `const { status, done_on, reader_effort, ...rest }` made
   `const { done_on, reader_effort, ...rest }` (contract keeps status). scripts/gates/test/pr-gate.test.mjs:
   green {pass 13, fail 0}, broken {pass 10, fail 3}, restored {pass 13, fail 0}. Red: "freeze gate: a status-only
   change passes" | "verdict gate: a contract reworded on main and merged in after the verified sha is refused; a
   status-only merge passes" | "a build PR whose first commit sets its item done passes freeze, and merges on a verdict
   from another session" (the new test).
2. scripts/reader-effort.mjs itemRange: `--reverse` dropped from the git log and the "adds" condition
   `|| has(cwd, ${sha}^1, verdict)` dropped, so --item takes the last merge touching the verdict file.
   scripts/reader-effort.test.mjs: green {pass 7, fail 0}, broken {pass 6, fail 1}, restored {pass 7, fail 0}. Red:
   "--item reads the merge that added the item's verdict, not a later one touching it".

Dropping `--reverse` alone does not turn it red: the adds check still skips the later merge.

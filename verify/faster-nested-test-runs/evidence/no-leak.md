# no-leak

Command: node --test verify/faster-nested-test-runs/no-leak.test.mjs

Inputs: base clone at 2009ca7f00aa68be82240b592dd1c8abbdfeea7d and head clone at ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f, each a full clone of github.com/suredesigntshirts/ccp_xstate with npm ci, under its own parent folder; 4-core container, Node v22.23.4, nothing else running. Recorded with `node verify/faster-nested-test-runs/record.mjs <base> <head> <out> 3`, summarized with `node verify/faster-nested-test-runs/summarize.mjs <out>/summary.json`.

Excerpt: record.mjs snapshots around every run: at the head no file changed git status, branches, worktrees or the parent folder in any round; at the base bin.test.js and standin.test.js left run/* branches and ../ccp-actors worktrees every round. The test also runs bin, standin and setup-install in a fresh clone of the head and finds status, branches, worktrees, parent folder and every tracked file mtime/inode unchanged.

```json
{
 "head": "ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f",
 "headLeaks": {
  "packages/engine/test/bin.test.js": [],
  "packages/engine/test/standin.test.js": [],
  "test/regression/engine/moved-tests-bite.test.mjs": [],
  "test/regression/gates/build-sets-done.test.mjs": [],
  "test/regression/gates/contract-and-verdict-tests.test.mjs": [],
  "test/regression/gates/evidence-links-listings.test.mjs": [],
  "test/regression/gates/verdict-cutoff.test.mjs": [],
  "test/regression/inspector/reads-records.test.mjs": [],
  "test/regression/plan/lean-ready-head.test.mjs": [],
  "test/regression/plan/no-doing-status.test.mjs": [],
  "test/regression/plan/ready-rules-named.test.mjs": [],
  "test/regression/plugin/moved-tests-bite.test.mjs": [],
  "test/regression/plugin/self-edit-check.test.mjs": [],
  "test/regression/plugin/setup-install.test.mjs": []
 },
 "baseLeaks": {
  "packages/engine/test/bin.test.js": [
   "branches",
   "worktrees",
   "parent"
  ],
  "packages/engine/test/standin.test.js": [
   "branches",
   "worktrees",
   "parent"
  ]
 }
}
```

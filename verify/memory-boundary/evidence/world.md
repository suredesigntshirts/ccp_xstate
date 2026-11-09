# world

Command: two throwaway PRs into main off the build head 40dc78dd706dc13ec7a6a08f5a4ba5e52b1e30cf, bodies with no `Item:` line; their `gates` job logs read with get_job_logs; both closed.

- #289, branch throwaway/memory-boundary-notes-only at 76a19129d7d8250d88dc1961344aae4d1a3cbd86 (one line added to docs/traps.md). gates job 129305556801, base a0027c9b8b2d88ff4c7d5d69eb00994c460d47fa: failure, "this PR changes CLAUDE.md, docs/gates.md, docs/language.md, scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/test/pr-gate.test.mjs outside plan/ and the notes files (docs/traps.md, docs/verifying.md) but names no item".
- #290, branch throwaway/memory-boundary-notes-and-rule at dd10aee5275cd3083bfe74e51be1ac948e8a666b (also a line in docs/layout.md). gates job 129305599375: failure, the same list with docs/layout.md added.

Reading: GitHub runs the new rule (the message is the head's; docs/traps.md is never named; docs/layout.md is). But a PR off an unmerged build head into main carries the build's own files, so the notes-only PR cannot be green before the build merges: the verdict gate diffs from the merge base with main, and verdict.yml runs only for PRs into main. The Expect line as written cannot be met at a pre-merge head.

The branches could not be deleted from this container (`git push --delete` disconnects at the proxy); they need deleting by hand.

## At f6fbdd5082f549f6c00df7a617d6b6313c01de19, after contract change #291

The line now asks that each refusal names only the build's own files outside plan/, never docs/traps.md, and names docs/layout.md when that is added. The same two branches got the head merged in: throwaway/memory-boundary-notes-only at 216e43f7994628b688315f05d0bccf7f1e6e1e74 (diff from the head: docs/traps.md only), throwaway/memory-boundary-notes-and-rule at c61cd9db180d86ab617e4c6976ba1428b9acbe04 (docs/traps.md and docs/layout.md).

- #292 gates job 129310685343: failure, "this PR changes CLAUDE.md, docs/gates.md, docs/language.md, scripts/gates/lib.mjs, scripts/gates/pr-gate.mjs, scripts/gates/test/pr-gate.test.mjs, verify/memory-boundary/evidence/ci.md, ... verify/memory-boundary/verdict.json outside plan/ and the notes files (docs/traps.md, docs/verifying.md) but names no item". Every name is a file of the build PR; docs/traps.md is absent.
- #293 gates job 129310731332: the same list with docs/layout.md added.

Both closed unmerged.

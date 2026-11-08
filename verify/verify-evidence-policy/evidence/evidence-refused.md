# evidence-refused

Command: `node --test verify/verify-evidence-policy/evidence-refused.test.mjs` at 7f52c6f6e724ab8af45cddf35cbde0847016f05e. Each case is an os.tmpdir()
git repo: a base commit on main holding a copy of the head's plan/, scripts/ and package.json plus
verify/x/notes.md (12 bytes), verify/old/big.json (204,800 bytes) and verify/old/suite.pass; then branch
build/vep-case with one commit, and `BASE_SHA=<base> node scripts/gates/pr-gate.mjs evidence` from its tip.

Excerpt (8/8 pass):
- adds verify/x/capture.json, 71,680 bytes: exit 1, "verify/x/capture.json is 71680 bytes, over the 65536-byte limit for a file under verify/"
- adds verify/x/listing.pass, one line: exit 1, "verify/x/listing.pass is a test listing (.pass)"
- grows verify/x/notes.md to 65,537 bytes: exit 1, "verify/x/notes.md is 65537 bytes, over the 65536-byte limit"
- adds verify/x/evidence/a.md, exactly 65,536 bytes: exit 0, "evidence gate passed"
- adds docs/huge.md, 204,800 bytes: exit 0
- deletes verify/old/big.json and verify/old/suite.pass: exit 0
- extra: renames verify/x/notes.md to notes.pass: exit 1 naming it; a .pass and a 70 KB file in one PR: both named

Against main 3946736 (VEP_REPO=<worktree of origin/main>): 0 of 8 pass (no evidence gate there).

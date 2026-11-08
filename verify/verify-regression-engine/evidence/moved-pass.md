# moved-pass

Command: `node --test verify/verify-regression-engine/moved-pass.test.mjs` at ad3d018 (each file run alone as a child, NODE_TEST_CONTEXT dropped, up to 6 at once; ~38 s).
Inputs: every `test/regression/**/*.test.mjs`; plan/items/<item>.md JSON heads for the header check.

Excerpt: 4/4 pass. "33 files, 239 tests pass", each file exits 0 with >= 1 pass. Every first comment's `// Expect:` line names ids the plan has (e.g. wf-intake/real, parity-cases/independent). No code file names `verify/...` or join(..., 'verify', '<folder>'); the patterns see each form in a control.
Note: retired-pins and bench-prompts scan every committed `*/items/*.jsonl` with git ls-files; none sits under verify/ at the head.

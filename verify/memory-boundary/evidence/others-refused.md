# others-refused

Command: `node --test verify/memory-boundary/others-refused.test.mjs` at 40dc78dd706dc13ec7a6a08f5a4ba5e52b1e30cf and again at f6fbdd5082f549f6c00df7a617d6b6313c01de19 (15 pass, 0 fail).

Inputs: the same temp repo as notes-pass; each PR commit changes `docs/traps.md` (or `docs/verifying.md` with plan/) and one other file; no `Item:` line.

Excerpt: exit 1, "names no item", and the refusal names the other file ("this PR changes <file> outside plan/ and the notes files (docs/traps.md, docs/verifying.md) ...") for: docs/gates.md, docs/layout.md, CLAUDE.md, scripts/gates/lib.mjs, a new scripts/gates/new.mjs, packages/engine/src/x.js, docs/language.md, docs/traps.md.bak, docs/verifying.md/x.md, docs/Traps.md, plans/x.md, verify/x/verdict.json, .github/workflows/ci.yml, a deleted docs/layout.md, and scripts/gates/lib.mjs beside docs/verifying.md and plan/ (plan/ file not named).

Not covered by the test, run by hand: a pure rename of docs/gates.md to docs/verifying.md while the base has no docs/verifying.md passes the gate, since `git diff --name-only` reports only the new name. The same hole lets a rename into plan/ pass at main, so it is not new; see the verdict's observations.

Bite: at main's 38573a0d the suite fails 15/15, since main's refusal names no file.

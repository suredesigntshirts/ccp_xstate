# rules-written

Command: `node --test verify/evidence-gate-edges/rules-written.test.mjs` and a read of the three files at 10dad10eaa0cb475756403011bb41923694d092c.

Excerpt: 4 tests, 4 pass.

- docs/gates.md evidence row: "an entry that is not a regular file (a symlink, a submodule), one larger than 64 KB
  (65,536 bytes), one named `*.pass`, or a test listing: a node:test pass and fail summary with ten or more result
  lines; a deletion is never read". Evidence section: "the gate tells what it can by shape, the brief the rest" and
  "reads as a test listing (`isListing` in `scripts/gates/lib.mjs`)".
- plan/README.md: "the gate refuses a link or a test listing, and the brief keeps out other captures."
- docs/language.md: a `test listing` row naming `isListing`.
- wc -l: CLAUDE.md 55 + plan/README.md 97 + docs/gates.md 77 = 229, under 230.

Against origin/main the first three fail.

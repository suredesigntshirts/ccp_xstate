# rules-written

`node --test verify/plan-reader-effort/rules-written.test.mjs` (3/3 pass), reading the files at the verified sha.

- plan/README.md table row: "| `reader_effort` | What did the build cost its reader? | The cleanups passed every gate while the harness grew |"
- plan/README.md done step 5: "Set the status to `done` and `done_on`; a build item also pastes `node scripts/reader-effort.mjs <pr> --json` into `reader_effort`."
- docs/gates.md, The contract freeze: "A frozen item's head (all but `status`, `done_on` and `reader_effort`) and `## Verifier brief` change only by its one contract change"
- docs/language.md: "| reader effort | What a change costs its reader: the lines a reader opens to follow it (its changed hunks plus the definitions they call), its exports added and removed, and its lines by category; a done build item records it in `reader_effort` | `scripts/reader-effort.mjs`, `plan/item.schema.json` `reader_effort` |"

# listing-refused

Command: `node --test verify/evidence-gate-edges/listing-refused.test.mjs` at 10dad10eaa0cb475756403011bb41923694d092c (also in a depth-1 clone).

Inputs: each listing is made at run time by writing a temp file of ten passing tests and running `node --test` on it
piped (TAP, the default when not a TTY) and with `--test-reporter=spec`; the output is committed on a PR branch of a
temp repo as verify/x/evidence/listing.txt and the gate runs with BASE_SHA set to the base.

Excerpt: 5 tests, 5 pass.

- TAP, 953 bytes: exit 1, "verify/x/evidence/listing.txt is a test listing (node:test results and a pass and fail summary); ..."
- spec, 318 bytes: exit 1, the same line.
- an evidence .md with the command, four result lines cut from a real TAP run and the tests, pass and fail summary: exit 0.
- verify/x/capture.json of 65,537 bytes and verify/x/notes.pass: exit 1, "is 65537 bytes, over the 65536-byte limit" and
  "verify/x/notes.pass is a test listing".
- a listing of 12 tests committed at the base, deleted on the branch: exit 0, never read.

Against origin/main's gate the TAP and spec cases fail; the other three pass.

Re-run at 9cec4e1d409949f143818904d5a2500cb8f9ec3c (after the builder merged main twice and set status done): the same results, 18 of 18 across the five test files.

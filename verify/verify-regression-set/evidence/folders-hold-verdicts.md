# folders-hold-verdicts

Command: `node --test verify/verify-regression-set/folders.test.mjs` at be4c72126ebb668b9a80272f388d26d93d55e232.

Excerpt: `87 folders hold verdict.json alone`; `folders holding tests: verify-regression-set`; 3 pass, 0 fail.

Inputs: the head tree; each item's status at the head. The earlier head 460bcbe failed this line (after-verdict-gaps and finish-ms-transcript-fixture, done at the base, still held suites); be4c721 retired them.

# tests-bite

Command: `node --test verify/verdict-cutoff-at-verified-sha/tests-bite.test.mjs` at 5005ddad872eb02941838cd88ceb900dbd7ef49a. Each mutation is made in an
os.tmpdir() copy of scripts/ and package.json, never in the checkout; the run is
`node --test --test-reporter=tap <named test file>` in the copy.

Excerpt (3/3 pass):
- lib.mjs contractMoves `return a.brief === b.brief ? moved : [...moved, 'Verifier brief'];` -> `return moved;`: lib.test.mjs green 18/0, broken 16 pass 2 fail, restored 18/0.
- lib.mjs checkDoneOn `if (was === undefined || was === now) continue;` -> `continue;`: lib.test.mjs green 18/0, broken 17 pass 1 fail, restored 18/0.
- pr-gate.mjs `before: show(verified, itemFile)` -> `before: show(head, itemFile)`: pr-gate.test.mjs green 12/0, broken 10 pass 2 fail, restored 12/0.

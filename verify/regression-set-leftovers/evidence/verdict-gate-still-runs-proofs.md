# verdict-gate-still-runs-proofs

Command: node --test verify/regression-set-leftovers/verdict-gate-runs-proofs.test.mjs

Excerpt: 2 pass at 204ba01e. A temp repo holding the head's plan/, scripts/ and package.json (whose npm test names no
verify/ path), a builder commit and a verifier commit naming verify/rsl-toy/toy.test.mjs: with the test passing, the
head's pr-gate.mjs verdict prints "verdict gate passed" and the test's marker file exists; with it failing by
assertion, the gate exits 1 naming proof-line and the file, and the marker exists.

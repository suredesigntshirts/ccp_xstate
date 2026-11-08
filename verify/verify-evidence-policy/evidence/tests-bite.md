# tests-bite

Command: `node --test verify/verify-evidence-policy/tests-bite.test.mjs` at 7f52c6f6e724ab8af45cddf35cbde0847016f05e. Each mutation is made in an
os.tmpdir() copy of scripts/ and package.json, never in the checkout; the run is
`node --test --test-reporter=tap scripts/gates/test/lib.test.mjs` in the copy.

Excerpt (2/2 pass):
- scripts/gates/lib.mjs `if (size > EVIDENCE_LIMIT)` -> `if (false)`: green 15/0, broken 14 pass 1 fail, restored 15/0.
- scripts/gates/lib.mjs `if (path.endsWith('.pass'))` -> `if (false)`: green 15/0, broken 14 pass 1 fail, restored 15/0.

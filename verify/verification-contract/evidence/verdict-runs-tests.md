# verdict-runs-tests

Command: `node --test verify/verification-contract/verdict-runs-tests.test.mjs` at 25dddc9.
Inputs: a temp git repo (git init, no history needed) holding the head's plan/, scripts/ and package.json plus
plan/items/vfy-toy.md (Expect v-line verifier, b-line builder, w-line world) on main; branch build/vfy-toy with a
builder commit (src/toy.txt, session_vc_builder) and a verifier commit (verify/vfy-toy/{pass,fail,crash}.test.mjs
and verdict.json, session_vc_verifier). Gate: `BASE_SHA=<base> PR_BRANCH=build/vfy-toy PR_BODY='Item: vfy-toy'
PR_LABELS='[]' node scripts/gates/pr-gate.mjs verdict` from the temp repo.

Excerpt: 12/12 pass. Passing tests, world line with no test: `verdict gate passed (item vfy-toy)`, with and without
observations. fail.test.mjs (assert.equal(1, 2)): exit 1, reason names v-line and fail.test.mjs. crash.test.mjs
(process.exit(3) after a passing test): exit 1, names v-line and crash.test.mjs. No test on v-line or on b-line:
exit 1 naming the id. Missing file, a path outside verify/vfy-toy/, a test_name matching no test: each exit 1.
Observations present or absent changes no outcome. Against main: 10 of 12 fail.

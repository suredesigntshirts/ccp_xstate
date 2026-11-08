```json
{
  "id": "pinned-fetch-temp-repo",
  "title": "Fetch pinned commits into a temp repo, never the checkout",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The four verifier suites that fetch a pinned commit missing from a shallow checkout (verify/fix-trace-writes-clone-cwd/lib.mjs, verify/test-fixture-edges/scope.test.mjs, verify/map-once-traps-written/suite-and-scope.test.mjs, verify/verify-regression-engine/lib.mjs) fetch it at depth 1 into a temp bare repo of their own and read it there, so they never write to the checkout's .git and run green side by side in ci.yml's depth-1 checkout; a checkout that already holds the commits is read as before. docs/traps.md's shallow-clone entry says a test fetches pinned commits into a temp repo, never the checkout.",
  "why": "In ci.yml's depth-1 checkout node --test runs suites in parallel, and each of these four runs git fetch --depth=1 origin <sha> into the checkout; concurrent fetches collide on .git/shallow.lock, the helper swallows the error, and a scope test fails at random. It failed twice on #239 (verify/fix-trace-writes-clone-cwd/scope.test.mjs, base and head commits readable) and the evidence-gate-edges verifier reproduced it with three parallel fetches. Every red rerun costs a builder or verifier a look (L-attention-is-the-constraint), and the next verifier copies whichever helper it finds unless the rule is written down (L-rules-live-in-the-repo).",
  "serves": [
    "L-attention-is-the-constraint",
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "fix-trace-writes-clone-cwd",
    "test-fixture-edges",
    "map-once-traps-written",
    "verify-regression-engine"
  ],
  "inputs": [
    {
      "ref": "verify/fix-trace-writes-clone-cwd/lib.mjs, verify/test-fixture-edges/scope.test.mjs, verify/map-once-traps-written/suite-and-scope.test.mjs, verify/verify-regression-engine/lib.mjs",
      "what": "The suites that fetch into the checkout"
    },
    {
      "ref": "verify/item-head-trim/scope.test.mjs, verify/effort-scope-own-pr/lib.mjs",
      "what": "Suites that already fetch into a temp bare repo, borrowing actions/checkout's extraheader"
    },
    {
      "ref": "plan/decisions/2026-11-08-done-verify-edits.md",
      "what": "When a PR may change a done item's verify/ tests"
    }
  ],
  "outputs": [
    {
      "ref": "verify/fix-trace-writes-clone-cwd/lib.mjs, verify/test-fixture-edges/scope.test.mjs, verify/map-once-traps-written/suite-and-scope.test.mjs, verify/verify-regression-engine/lib.mjs",
      "what": "A pinned commit missing here is fetched at depth 1 into a temp bare repo, removed when the process exits, and read from there; the header says so"
    },
    {
      "ref": "docs/traps.md",
      "what": "The shallow-clone entry: a test that needs a pinned commit fetches it into a temp repo, never the checkout, since parallel fetches collide on .git/shallow.lock"
    }
  ],
  "expect": [
    {
      "id": "no-checkout-fetch",
      "check": "In a depth-1 clone of the head whose origin serves any sha, running the four suites (verify/fix-trace-writes-clone-cwd, verify/test-fixture-edges, verify/map-once-traps-written, verify/verify-regression-engine) passes, and the clone's .git/shallow still lists only the head; the base's four files in the same clone add the pinned commits to .git/shallow",
      "how": "The verifier's own test making a full local origin and a depth-1 clone of it in a temp folder",
      "proof": "verifier"
    },
    {
      "id": "parallel-green",
      "check": "In such a depth-1 clone of the head, the four suites each started three times at once (twelve node --test processes in parallel) all pass",
      "how": "The verifier's own test starting the processes together and reading every exit code",
      "proof": "verifier"
    },
    {
      "id": "trap-written",
      "check": "docs/traps.md's shallow-clone entry says a test that needs a pinned commit fetches it into a temp repo and not the checkout, naming .git/shallow.lock",
      "how": "The verifier's own test reading the entry",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR changes only the output files and plan/items/pinned-fetch-temp-repo.md; no verdict.json or evidence file under verify/ changes",
      "how": "The verifier's own test reading git diff --name-only between base and head",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and verdict checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No gate, engine, plugin or workflow change; no release",
    "No shared helper module: the four suites move or retire with verify-regression-set, which keeps one helper for the regression set",
    "The edited suites' Expect lines, verdict.json and evidence stay as they are"
  ],
  "records": [
    "None"
  ],
  "step_back": {
    "max_rounds": 2
  },
  "verifier": "A separate session, using the Verifier brief below."
}
```

Found on 8 Nov on #239: `verify/fix-trace-writes-clone-cwd/scope.test.mjs` failed twice with "base and head commits
readable", and three `git fetch --depth=1 origin <sha>` run at once in one checkout fail with "Unable to create
.git/shallow.lock: File exists". Four suites fetch into the checkout this way; two newer ones
(`verify/item-head-trim/`, `verify/effort-scope-own-pr/`) already fetch into a temp bare repo and never collide.

Options considered:

- **Temp bare repo per suite** (chosen). Nothing shared is written, so there is no lock to take and no retry to tune;
  the checkout stays exactly as ci.yml left it, which other suites rely on (no `origin/main`, still shallow).
- One helper that retries on the lock. Smaller diffs, but every suite still writes the checkout's `.git/shallow`, and
  a retry count is a guess about how many suites run at once.
- A shared module for the temp fetch. The four suites leave `verify/` with `verify-regression-set`, which then owns
  one helper for the regression set; a module now would be moved again there.

Editing done items' `verify/` tests follows `plan/decisions/2026-11-08-done-verify-edits.md`: each file is named in
`inputs` and `outputs`, no Expect line changes, and no verdict or evidence is touched. `verify-regression-set` now
waits for this item, so it moves the fixed files.

## Verifier brief

Check out the PR head in a full clone (`git fetch --unshallow origin` if needed) and run `npm ci`. Without reading the
builder's diff first, write your tests under `verify/pinned-fetch-temp-repo/`. For a depth-1 clone whose origin serves
any sha, make a local full clone as origin with `uploadpack.allowAnySHA1InWant true` and clone it with
`--depth=1 file://...`; run the suites there through child `node --test` processes. Your own tests must pass in ci.yml's
depth-1 checkout too, and must not fetch into it.

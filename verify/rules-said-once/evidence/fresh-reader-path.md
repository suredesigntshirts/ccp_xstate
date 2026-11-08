# fresh-reader-path

Clean clone of the build head 528c009 (the head before main was merged in; 45d60e2 differs from it only by plan/ files #200 and #201 brought), origin removed. Run from the clone:

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "$(cat prompt.txt)" --allowedTools "Read,Glob,Grep,Bash(git log:*),Bash(ls:*),Bash(cat:*)"
```

## Prompt (the whole of it)

```
Using only this repository, answer for the draft item `test-fixture-edges`: (1) the branch, label, body lines and files of the PR that makes it ready; (2) the branch and body lines of its build PR, and what every commit must end with; (3) who writes its verdict, where, and what the gate needs from it; (4) when the build PR may merge and what follows the merge, including the done replan's branch, label and changes.
```

## Answer (verbatim)

All of this comes from `plan/README.md` ("How an item moves", "How slop is kept out"), `docs/gates.md`, `plan/item.schema.json` and `plan/items/test-fixture-edges.md`. The item is a `draft` build item at stage `s5-parity`, and it depends on `self-edit-check-snapshot`.

**1. The PR that makes it ready (the readying replan)**
- **Branch:** `replan/<topic>`, for example `replan/test-fixture-edges-ready`. The README fixes only the `replan/` prefix. The topic is mine to pick.
- **Label:** `replan`.
- **Body lines:** no `Item:` line. A PR names its item only through `Item: <id>`, and the readying replan must not name one.
- **Files:** only files under `plan/`. The change is `plan/items/test-fixture-edges.md`, and `plan/check.mjs` must pass with status `ready`.
- **Fields to fill in the head:** the item already has `why`, `serves` and `depends_on`. The schema's `readyRequired` list also needs `inputs`, `outputs`, `expect`, `concepts` (`adds` and `budget`), `non_goals`, `records`, `step_back` (`max_rounds`) and `verifier`.
- **`expect` rules:** each line needs a `proof` of `world`, `verifier` or `builder`. A ready build item needs at least one `world` line, and at most half its lines may be `builder`. A check may not contain a sha or a main-pinning phrase such as "unchanged" or "byte".
- **Prose:** add a `## Verifier brief`.

**2. The build PR**
- **Branch:** `build/test-fixture-edges`, which is `<kind>/<id>` with kind `build`.
- **Body line:** `Item: test-fixture-edges`.
- **First commit:** sets the status to `doing`. The contract is frozen from then on.
- **Every commit must end with:** a `Claude-Session: <id>` trailer. The id is the thread's session URL, or `<thread session URL>#agent=<name>` for a subagent. The cloud attribution reminder also asks for `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`, but the repo's own rule is the trailer.

**3. The verdict**
- **Who writes it:** a separate session, not the builder's. It gets the item's Verifier brief and not the builder's tests.
- **Where:** it commits `verify/test-fixture-edges/verdict.json` to the build PR's branch. Its tests and evidence go under `verify/test-fixture-edges/`, with one `evidence/<expect-id>.md` file per Expect line.
- **What the gate needs at the PR head sha:**
  - Every Expect id, and no other, has a `MET` result with a non-empty `command` and `excerpt`.
  - Every `verifier` or `builder` result has a `test` file under `verify/test-fixture-edges/` (optionally `test_name`). The gate runs it with `node --test-reporter=tap`, and it must exit 0 and pass at least one test. A `world` result names no test.
  - Every `builder` result also has `mutation` and `red_test`.
  - `verified_sha` is in the PR's history, and no later non-merge commit changes anything outside `verify/`.
  - The last commit that wrote `verdict.json` carries a `Claude-Session:` trailer that no commit changing anything outside `verify/` carries.
  - `observations` is an optional list of strings and never gates.
  - Evidence files are at most 64 KB and none is named `*.pass`.

**4. Merge and what follows**
- **When it may merge:** when `ci` and `verdict` are both green at the head sha. To take main after the verdict, merge main in rather than rebase.
- **Right after the merge:** the merging thread runs `git fetch origin main && node scripts/release/release.mjs branch --push`. It makes a `release/harness-v<x.y.z>` branch only if the merge changed `plugins/harness/` or `packages/journal/`, tests aside. Otherwise it makes nothing. The item's edges touch `test/` and `scripts/debug/`, plus a test under `plugins/harness/test/`, so this likely makes no release.
- **Done replan:**
  - **Branch:** `replan/test-fixture-edges-done`, which is `replan/<id>-done`.
  - **Label:** `replan`.
  - **Scope:** changes under `plan/` only.
  - **Changes:** set `status` to `done` in `plan/items/test-fixture-edges.md`, and add a `## Done` section saying where the item was built and verified. `done_on` is required only for `fix-` items, and this is a build item.

## Grading

- (1) readying replan: branch `replan/<topic>`, label `replan`, no Item line, `plan/` only, status `ready` with check.mjs passing. Agrees with plan/README.md "How an item moves" step 1 and the verdict gate (a plan-only PR with no Item line passes).
- (2) build PR: `build/test-fixture-edges`, `Item: test-fixture-edges`, first commit sets `doing`, every commit ends with `Claude-Session: <id>`. Agrees with step 2 and docs/gates.md "Sessions". (It also mentioned the cloud attribution reminder's Co-Authored-By line, and said the repo's rule is the trailer.)
- (3) verdict: a separate session, `verify/test-fixture-edges/verdict.json` on the build branch; MET results with command and excerpt, `test` under `verify/<item>/` for verifier and builder lines and the gate runs it, `mutation` and `red_test` for builder lines, verified_sha in history with no later non-merge change outside `verify/`, a Claude-Session no builder commit carries, observations never gate, evidence under 64 KB and not `*.pass`. Every clause matches docs/gates.md "The verdict" and "Evidence".
- (4) merge when `ci` and `verdict` are green at the head sha, merge main in rather than rebase, then `git fetch origin main && node scripts/release/release.mjs branch --push` (makes a release only for `plugins/harness/` or `packages/journal/`); done replan `replan/test-fixture-edges-done`, label `replan`, `plan/` only, status `done`, a `## Done` section, `done_on` only for fix items. Matches step 4, step 5 and docs/gates.md "After the merge".

## Carried out

`node --test verify/rules-said-once/fresh-reader-path.test.mjs` copies plan/, scripts/ and package.json into a temp git repo, commits each answer as a PR branch off the base, and runs `node scripts/gates/pr-gate.mjs freeze|verdict` with BASE_SHA, PR_BRANCH, PR_BODY and PR_LABELS set:

```
# replan/test-fixture-edges-ready freeze: freeze gate passed
# replan/test-fixture-edges-ready verdict: verdict gate passed
# build/test-fixture-edges freeze: freeze gate passed (item test-fixture-edges)
# build/test-fixture-edges verdict: verdict gate failed (item test-fixture-edges):\n  no verify/test-fixture-edges/verdict.json at the head sha
# replan/test-fixture-edges-done freeze: freeze gate passed
# replan/test-fixture-edges-done verdict: verdict gate passed
# pass 3, fail 0
```

The build PR is refused only for its missing verdict, not for its naming. MET.

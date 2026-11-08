# fresh-verifier: a fresh headless session's answer

Run by the verifier on 2026-11-08 in a clean clone of the build head 57905cc3de056f462fe848141759ec315298dfe5
(cloned from the local mirror, origin removed, no npm ci needed for reading), with:

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "<prompt>" --allowedTools "Read,Grep,Glob,Bash(ls:*),Bash(cat:*),Bash(grep:*)"
```

## Prompt

Using only this repository, you are a new session asked to verify a build PR. How do you run the verdict gate locally
before committing, does a world result in verdict.json name a test, which sha does your evidence for the PR's ci
checks cite, and what goes in the verdict's model field? Cite the files.

## Answer

**Run the gate locally.** From the checkout's HEAD, run `BASE_SHA=origin/main PR_BODY='Item: <id>' node scripts/gates/pr-gate.mjs verdict` (`docs/gates.md:15-16`). The gate is `scripts/gates/pr-gate.mjs`, with the checks in `scripts/gates/lib.mjs`. It checks the verdict against the item head and the PR head sha. So `verdict.json` must be committed first, and the gate refuses anything uncommitted or unverified. The sibling checks use the same entry point, for example `pr-gate.mjs evidence`. CI also runs `npm test` and `node plan/check.mjs` (`CLAUDE.md`, Commands). Run the tests that match the Item's `verify/<item>/` files, naming the files rather than the folder, as `CLAUDE.md` says.

**Does a `world` result need a test?** No. `docs/gates.md:40-41` says a `world` result needs no `test`. `scripts/gates/lib.mjs:123` says the same: "A world line is shown by the platform, not a test." Only `verifier` and `builder` results name a file under `verify/<item>/` in `test` (`docs/gates.md:42-43`). Each `builder` result also needs a `mutation` and a `red_test`, enforced at `lib.mjs:113`. Every `world` result still needs `status: MET` and a non-empty `command` and `excerpt` (`docs/gates.md:40`).

**Which sha for the PR's ci checks?** `verified_sha`, which is the commit you checked out. `docs/gates.md:40-41` says a world result about the PR's checks "cites them at `verified_sha`, since they run again on the verdict commit". Don't cite the head sha you'll push, because your verdict commit creates a new head. `verified_sha` must be in the PR's history. After it, only merge commits may change anything outside `verify/` (`docs/gates.md:46-47`). The item's contract at `verified_sha` must also match the head's, or the gate names the fields that moved.

**What goes in `model`?** `verifier.model` is "its own model id", your own, as in the schema example at `docs/gates.md:25`. For this session that is `claude-sonnet-5-5`. `verifier.session` is your `Claude-Session` value. The code I searched does not check the `model` string, so the docs are the only rule on it. The gate does check that the last commit to `verdict.json` has a `Claude-Session:` trailer that no commit changing files outside `verify/` has (`docs/gates.md:48`; `lib.mjs:193-204`).

I read the gate code and docs only. I did not run the gate.

## Grading

1. Local verdict-gate command with PR_BODY carrying the Item line: MET. It gives
   `BASE_SHA=origin/main PR_BODY='Item: <id>' node scripts/gates/pr-gate.mjs verdict`, citing docs/gates.md:15-16.
2. A world result needs no test: MET. "No", citing docs/gates.md:40-41 (and scripts/gates/lib.mjs:123).
3. Which sha a line about the PR's checks cites: MET. `verified_sha`, citing docs/gates.md:40-41, with the reason
   (the verdict commit makes a new head and the checks run again on it).
4. model is its own model id: MET. "its own model id", citing docs/gates.md:25.

The answer's one stray claim, that the gate "refuses anything uncommitted", is a reading of "against the item head at
the PR head sha" and not wrong for the committed verdict. fresh-verifier.test.mjs regrades these four points and checks
each cited text is in docs/gates.md at the checkout.

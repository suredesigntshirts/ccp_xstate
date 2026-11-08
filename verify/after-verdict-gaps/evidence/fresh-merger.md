# fresh-merger: a fresh headless session's answer

Run by the verifier on 2026-11-08 in a clean clone of the build head 924f822ee0f1bac754fe1e8edbaf89a3328d6a74 (cloned
from the local checkout, origin removed, `npm ci` run), from inside the clone, with an empty HOME and the container's
memory and extra-directory variables unset, so only the repository was read:

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID -u CLAUDE_MEMORY_STORES -u CLAUDE_COWORK_MEMORY_PATH_OVERRIDE \
  -u CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD -u CLAUDE_ADDITIONAL_DIRECTORIES HOME=<empty dir> \
  claude -p "<prompt>" < /dev/null
```

## Prompt

Using only this repository, you built a plan item's PR and a verifier has committed its verdict. If one line is NOT MET, what happens next? When all are MET, how do you merge, and may you merge main in first without a new verdict? Who is your starter? Cite the files.

## Answer

**If a line is NOT MET**
- You push a fix to the build PR's branch.
- You ask your starter for a verifier again.
- A separate verifier session then commits a new `verify/<id>/verdict.json`. The next verdict replaces the last one.
- This is step 3 of "How an item moves" in `plan/README.md`.
- Per `plan/README.md` step 2, you write nothing under `verify/<id>/` yourself. The `step_back` cap on the item's rounds also applies, and past it you replan.
- `docs/gates.md` shows why a self-written verdict can't work. The `verdict` gate refuses a verdict from a builder's session. It also requires that the last commit to `verdict.json` carries a `Claude-Session:` trailer that no commit outside `verify/` has.
- If your fix touches the item's contract, that's frozen. `docs/gates.md`, "The contract freeze", refuses any head or brief change once `verdict.json` exists.

**If all lines are MET: how to merge**
- Merge with a merge commit, not a rebase or squash. This is step 4 of `plan/README.md`.
- Merge when `ci` and `verdict` are both green at the PR's head sha. `docs/gates.md` says a PR merges only then.
- After the merge, run `git fetch origin main && node scripts/release/release.mjs branch --push`. It pushes `release/harness-v<x.y.z>` only if the merge changed a path in `RELEASED` (`docs/gates.md`, "After the merge"; `plugins/harness/README.md`).
- Then tell your starter what the command printed. No PR follows.

**Merging main in first**
- Yes, you may, and the verdict stays valid. `plan/README.md` step 4 says "merging main in after the verdict keeps it, a rebase does not."
- `docs/gates.md` gives the mechanism. The gate requires that no commit after `verified_sha`, other than a merge, changes anything outside `verify/`. It also requires the item's contract at `verified_sha` to match the head's.
- So a clean merge of main is fine. Any other new commit outside `verify/` voids the verdict.
- A rebase rewrites history, so `verified_sha` is no longer in the PR's history.

**Who your starter is**
- `docs/language.md` (Platform table) defines it: "The session that started a thread and hears its asks: the coordinator, or the person."
- You ask it for the verifier, and you report the release output to it.

This is the rule that `plan/items/after-verdict-gaps.md` set out to document. I didn't run the gates; I only read these files.

## Grading

Against the Expect line's points, each checked in the files it cites (fresh-merger.test.mjs redoes this):

- NOT MET means a fix and a new verdict replacing the last: MET. "You push a fix ... You ask your starter for a
  verifier again ... The next verdict replaces the last one", citing `plan/README.md` step 3.
- The merge is a merge commit: MET, citing `plan/README.md` step 4.
- Merging main in keeps the verdict: MET. It quotes step 4 and gives the gate's mechanism from `docs/gates.md`.
- Who its starter is: MET, quoting the `docs/language.md` Platform line ("the coordinator, or the person").

It cited only repository files and said it ran no gates.

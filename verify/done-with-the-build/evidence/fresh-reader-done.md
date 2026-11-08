# fresh-reader-done

Clone: `git clone /home/user/ccp_xstate /tmp/dwtb-fresh`, detached at 807999f1362281bc882f39a584bbd20935748762, origin removed.
Command, in the clone: `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "<prompt>" --allowedTools Read Glob Grep < /dev/null`.

Prompt:

> Using only this repository, answer: plan item X is ready. What PRs does it take to become done, what does each
> change, and is any PR needed after the build PR merges?

Grade: MET. The answer says the build PR's first commit sets status done (and done_on), that it merges when ci and
verdict are green, that the verdict is committed to the same branch, and "There is no further plan PR ... No PR
follows"; the only later PR it names is a release branch for merges touching plugins/harness/ or packages/journal/,
which plan/README.md step 4 also says. Its last line shows it also read the container's shared team memory, outside the
clone; it set that aside as older practice.

Answer, verbatim:

    From `plan/README.md` ("How an item moves") and `docs/gates.md` ("After the merge"), a ready item takes **three PRs**. The first two are replan and build PRs. The third is a release PR, and only some items need it.
    
    Two of the PRs come before the build merge. One is the readying replan, which is why the item is already ready. The other is the build PR itself, so only one more PR is still to come.
    
    1. **Readying replan (already merged, since the item is `ready`).**
       - Branch `replan/<topic>`, label `replan`, no `Item:` line.
       - It changes `plan/` only.
       - It fills the item's JSON head until `node plan/check.mjs` passes with status `ready`.
    
    2. **Build PR.**
       - Branch `<kind>/<id>`, for example `build/journal-schema`. The body has `Item: <id>`, which freezes the contract.
       - It holds the implementation. Its first commit sets the item's status to `done` and sets `done_on`. The verdict gate is what makes that true.
       - A separate verifier session writes its tests and evidence under `verify/<id>/`. It commits `verify/<id>/verdict.json` to this same PR branch. That adds no extra PR.
       - Merge when `ci` and `verdict` are both green at the head sha. If main moved after the verdict, merge main in rather than rebasing.
    
    3. **Release PR (only some items).**
       - After the merge, the merging thread runs `git fetch origin main && node scripts/release/release.mjs branch --push`.
       - If the merge changed `plugins/harness/` or `packages/journal/` (tests aside), that pushes a `release/harness-v<x.y.z>` branch. Merging it is the release PR, and `release.yml` tags on merge.
       - Otherwise the command makes nothing, so it is safe to run after every merge.
    
    **Is any PR needed after the build PR merges?** There is no further plan PR. `plan/README.md` says "No PR follows", because the status flip to `done` already rode in the build PR's first commit. The only exception is the release branch above, which exists only when the build touched `plugins/harness/` or `packages/journal/`.
    
    The team memory also mentions "done replan" PRs for older items, such as #201 and #238. Those predate this rule, and the repo as written doesn't call for one.

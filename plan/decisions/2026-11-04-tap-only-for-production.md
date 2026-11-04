# The person taps only for one-way doors into production (2026-11-04)

**Said (person, 03:25Z):** "Do I ever need to be around to confirm CI is green, or merge everything. This seems like a
waste of my attention". Then (03:29Z): "Seems like I only care about merging one way doors to production, and not
development. If it's a one way door in a development branch, I shouldn't have to care".

This restates ledger L-merge-authority (27 Oct: "You merge. I don't merge.") and narrows the one tap left.

**Decided:**
- **CI green is never a person step.** The host reads it from GitHub, and a guard checks it.
- **Merges into development branches need no tap**, including PRs that change CI files. The host merges by policy
  when the verdict PASSed at the head sha and required CI is green at that sha. This covers feature branches, slice
  merges, tournament lanes, scratch and test repos, and ccp_xstate's own `main`, which is development: harness changes
  reach sessions only through a release.
- **The person taps only when work crosses into production.** Production is named per repo: a release of the
  harness (`release/harness-v*`) and a product repo's deploying branch (its `main` unless the repo says otherwise).
  Development work collects on a development branch, and promoting it to production is one card for the batch, not
  one per PR (the F1 feature-branch shape).
- **One-way doors that aren't merges still reach the person**, wherever they happen: settings, secrets, messages
  outside the project, deleting things. They go to `waiting-for-person.md`, and work continues around them.

**Consequences for the plan:**
- quick-fix's `awaitingMerge` card applies only to a target branch named as production. For any other target, the
  approval comes from the policy and is journalled as `standin:policy`, still counted as a would-be tap.
- Tournament and benchmark runs never wait on the person. Their configs name no production branch.
- Person prereq: an auto-mode allow rule for policy merges in product and test repos. Without it, the classifier
  refuses them as "Merge Without Review" (2026-10-31, ccp_machine_test).

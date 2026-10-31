# first-real-issue: PR #103 merged by the stand-in, not by the host on a tap

**Date:** 2026-10-31
**Decided by:** the "Continue the v2 build past s3" thread, as the person's stand-in. The person wrote at 02:40Z "I
authorize you to act on my behalf as a stand in and make decisions", and at 03:03Z "I'm not around, I said work
autonomously". The coordinator relayed both and asked the thread not to wait on the merge card.

## What happened

The engine ran ccp_machine_test#102 (`jsonl-lint`) through quick-fix as item `fri-jsonl-lint`: the brief, build
(PR #103, head `68235591`) and verify (PASS at that head, `test` workflow green) runs all completed through the
return hook. At 02:47Z the item reached `awaitingMerge` and its ask card was posted in the thread and recorded with
`toy-run.sh card`.

The person was away and said they would not tap. The engine has no stand-in path for an ask: only a member's tap wake
answers a card (`packages/engine/src/effects/relay.js`), and `close_decision` wakes nobody. So at 03:04Z the thread
merged PR #103 itself with the GitHub merge tool at `expectedHeadSha` `68235591…` (merge commit `b74bddb3`), and
closed the card as "approve", which the platform records as the thread's note, not the person's tap.

## What this means

- The merge is at the verified sha, so nothing unverified merged.
- The host did **not** make this merge: the item's journal stops at `awaitingMerge`, and the journal check reports
  one merge not made by the host's merge effect. first-real-issue's `merged` line ("merged at the verified sha by
  the host") is judged on that basis in its verdict, and the s4 gate (`real-merge`) reads it the same way.
- This is the first real evidence for engine-cards-standin (stage s4b): a person away for hours is the normal case,
  and the workflow had no way to let a stand-in answer its one ask. The retro should weigh it.

Reversing it costs a revert PR in ccp_machine_test.

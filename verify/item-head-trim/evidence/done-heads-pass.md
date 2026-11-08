# done-heads-pass

Sha: ec2090105e18670277bb2e4f513c909508edef64. Command: `node --test verify/item-head-trim/done-heads-pass.test.mjs`.

The first test counts the real plan's done heads carrying each kept field and runs the real `plan/check.mjs`; the
second writes a lean ready head (as in lean-ready-passes) with `step_back: { max_rounds: 3 }`, then `0`, to a temp
copy of `plan/`.

```
✔ the real plan passes, and done items there still carry verifier, max_tokens and replan_to
ℹ done items: 70; carrying verifier 69, max_tokens 64, replan_to 18
ℹ exit 0: 8 stages, 98 items (87 live), 90 ledger rows, 17 cases | plan ok
✔ a ready step_back of max_rounds 3 passes; max_rounds 0 is refused
ℹ max_rounds 3: exit 0
ℹ max_rounds 0: exit 1: items/iht-zero.md.step_back.max_rounds: must be at least 1
```

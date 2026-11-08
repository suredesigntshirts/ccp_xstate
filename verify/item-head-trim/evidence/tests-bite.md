# tests-bite

Sha: ec2090105e18670277bb2e4f513c909508edef64. Command: `node --test verify/item-head-trim/tests-bite.test.mjs`.

In a temp folder holding a copy of `plan/` and of `test/plan-check.test.mjs`, the test runs the file (green), appends
`verifier` to `readyRequired` in the copy's `plan/item.schema.json` (red), restores the original bytes (green).

```
✔ plan-check.test.mjs goes red with verifier back in readyRequired, green when restored
ℹ green {"pass":15,"fail":0}, broken {"pass":14,"fail":1}, restored {"pass":15,"fail":0}; red: a ready head needs no verifier and no step_back; it still needs expect
```

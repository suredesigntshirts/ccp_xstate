# scope

Command: `node --test verify/test-fixture-edges/scope.test.mjs` (git diff --name-only 66e47a6a5417484a3da9947148fcb25de73e6738
af64a367c242b66cf968aad168b40e5141d029a3; fetches either at depth 1 when the checkout lacks it).

Excerpt:

```
# plan/decisions/2026-11-08-capture-p95-over-bare-start.md, plugins/harness/test/capture.test.mjs, scripts/debug/trace-writes.mjs, scripts/debug/trace-writes.test.mjs, test/setup.test.mjs, verify/self-update-by-version/no-self-edit.test.mjs
```

All six are in the item's list; none under packages/, workflows/ or plugins/harness/ outside test/.

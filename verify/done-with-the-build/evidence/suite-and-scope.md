# suite-and-scope

Head: 807999f1362281bc882f39a584bbd20935748762; base fd32883dc13395f662f6b64fe0db3bb524e95efd (main at the merge of #240, the PR's merge base).

Scope: `node --test verify/done-with-the-build/scope.test.mjs` (the two trees, fetched at depth 1 into a temp bare
repo when the checkout lacks them). Changed: CLAUDE.md, docs/language.md, plan/README.md, plan/check.mjs,
plan/item.schema.json, plan/items/done-with-the-build.md, scripts/gates/test/pr-gate.test.mjs, scripts/reader-effort.mjs,
scripts/reader-effort.test.mjs, test/docs.test.mjs, test/plan-check.test.mjs, verify/item-head-trim/lib.mjs,
verify/item-head-trim/tests-bite.test.mjs, verify/plan-reader-effort/plan-rule.test.mjs,
verify/plan-reader-effort/rules-written.test.mjs: every one an output or the item file. docs/gates.md, an output, is
unchanged.

Plan check: `node plan/check.mjs` at the head: "8 stages, 100 items (89 live), 90 ledger rows, 17 cases / plan ok".

Suite: ci test job 128722108570 at the head: success. Locally after `npm ci`, `npm test`: tests 2046, pass 2039,
fail 2, both from this container's clone, not the change:
- "every done fix item: module and done_on set, done_on = first done commit date..." (fix-budget-rule's backfill needs
  full history; this clone is shallow).
- verify/plan-reader-effort "the PR changes only the files its outputs name..." (diffs against origin/main from a
  branch; #234 fixes it; ci.yml's depth-1 checkout skips it).

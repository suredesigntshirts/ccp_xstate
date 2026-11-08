# suite-and-scope

At d6df5a7674e7ca52454c4b388542b0343cba39e6, in a full-history clone (git fetch --unshallow) after npm ci:

- `npm test` (with verify/rules-said-once/ stashed, so the suite as the builder left it): exit 0, `# tests 1884`,
  `# pass 1879`, `# fail 0`. In a shallow clone at 45d60e2 one test failed, verify/fix-budget-rule/backfill-true
  ("first done commit is a shallow boundary; fetch more history"), which needs history, not this change.
- `node --test verify/rules-said-once/suite-and-scope.test.mjs` (base: origin/main, merge-base with the head):

```
ok 1 - node plan/check.mjs passes          (8 stages, 93 items (82 live), 90 ledger rows, 17 cases / plan ok)
ok 2 - the PR changes only the files its outputs name, and only the named verify/ changes
# PR mode: 16 files; M CLAUDE.md, M docs/gates.md, M docs/selfcheck.md, M docs/tournaments.md, M plan/README.md,
  M plan/items/rules-said-once.md, M scripts/gates/lib.mjs, M scripts/gates/pr-gate.mjs, M scripts/gates/test/lib.test.mjs,
  M scripts/gates/test/pr-gate.test.mjs, A test/docs.test.mjs, D verify/fix-budget-rule/rule-written.test.mjs,
  M verify/harness-glossary/notes.test.mjs, D verify/repo-skeleton/claude-md.test.mjs,
  D verify/verification-contract/rules-written.test.mjs, M verify/verify-evidence-policy/policy-written.test.mjs
# scripts/gates/pr-gate.mjs: header line drops PR_BRANCH; namedItem({ branch: env.PR_BRANCH, body: ... }) -> namedItem({ body: ... })
```

scripts/gates/pr-gate.mjs is not in the outputs but is in the inputs as namedItem's caller; its two changed lines are
the call and the header naming the environment it reads, which the test pins. In ci.yml's depth-1 checkout (no base)
the test checks the tree instead: the three files are gone, notes.test.mjs has no CLAUDE.md test, policy-written keeps
only its docs/gates.md test. Checked in a depth-1 clone: pass 2.

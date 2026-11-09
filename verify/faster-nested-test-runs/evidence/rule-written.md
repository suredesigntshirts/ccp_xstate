# rule-written

Command: `node --test verify/faster-nested-test-runs/rule-written.test.mjs` at ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f (4 pass).

Inputs: docs/layout.md at that sha; the test matches each term that carries a rule, within the paragraph of the Tests section that holds it.

Excerpt: the Tests section's new paragraph says a test that runs another test file runs only the tests the broken rule turns red with `onlyTests`, checks with `ranTests` that each named test ran because a name pattern that matches nothing passes, that a copy of the repo links `bench/`, `tournaments/` and `node_modules/` rather than copying them, and that a test writes only under its own temp folder, never in or beside the checkout.

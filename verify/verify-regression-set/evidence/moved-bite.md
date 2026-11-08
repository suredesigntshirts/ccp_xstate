# moved-bite

Command: `node --test verify/verify-regression-set/bite.test.mjs` at be4c72126ebb668b9a80272f388d26d93d55e232, each case on a temp copy of the head.

Excerpt:
- plan: `"doing"` added to plan/item.schema.json's status enum; test/regression/plan/no-doing-status.test.mjs 2 red, restored 10 pass.
- gates: checkCutoff in scripts/gates/lib.mjs sees no move (`const moved = [];`); test/regression/gates/verdict-cutoff.test.mjs 5 red, restored 18 pass.
- engine (this PR adds engine/event-close-tag.test.mjs): packages/engine/src/wake.js closes an event at any `</event>`; that file 7 red, restored 20 pass.

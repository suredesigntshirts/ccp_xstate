# rule-written

Head `c7f14a8ceaba62448e8d92ceb75fe79ff81e2aa8`. `node --test verify/rule-text-tests/rule-written.test.mjs`: 5/5 pass. The Tests section of
docs/layout.md has one paragraph about rule texts: "A test that reads a rule text (`CLAUDE.md`, `plan/`, `docs/`)
checks the words that carry the rule, never a whole sentence, so a rewording that keeps the rule keeps the test green."
The test matches each point by its own words (CLAUDE.md, plan, docs; words, carry; never ... whole sentence; reword,
green), within that paragraph.

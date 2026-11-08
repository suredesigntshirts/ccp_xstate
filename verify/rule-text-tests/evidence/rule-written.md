# rule-written

Head `772c1ad68d096cb0956aea1547f70976fc479a51`. `node --test verify/rule-text-tests/rule-written.test.mjs`: 6/6 pass. The Tests section of
docs/layout.md has one paragraph about rule texts: "A test that reads a rule text (`CLAUDE.md`, `plan/`, `docs/`)
matches each word or term that carries the rule on its own (for "the first commit sets the status to `done`":
`first commit`, `status`, `done`), never a phrase or a whole sentence, so a rewording that keeps the rule keeps the
test green." The test matches each point by its own words (CLAUDE.md, plan, docs; word, carries; never, phrase;
sentence; reword, green), within that paragraph.

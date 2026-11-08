# reads-fixture

Command: `node --test verify/finish-ms-transcript-fixture/reads-fixture.test.mjs`

Inputs: head c21887e36730ee64dd83476fcd73fbb510c5889c, cloned at depth 1 into a temp folder (`fmtf-head-<pid>-*`) from a
temp bare repo (`fmtf-pinned-<pid>-*`) holding the head and base; `verify/probe-plugin-agents-thread/evidence/` deleted
from that clone's work tree; `node --test --test-reporter=tap plugins/harness/test/finish-ms.test.mjs` run there with
NODE_TEST_CONTEXT removed. Run both in the full checkout and in a depth-1 clone whose origin is GitHub.

Excerpt:

- The child exits 0 with `# fail 0`, and `ok 7 - the verifier transcript of probe-plugin-agents-thread gives its real 4944`
  is among its passes. The test body still holds `assert.equal(ms(path), 4944)` and joins
  `'test', 'regression', 'fixtures', 'agent-transcript.jsonl'`.
- Searching every file under plugins/, packages/, scripts/ and test/ at the head for a path under
  verify/probe-plugin-agents-thread (slashes, or quoted joined segments) finds none.

Bite, run by hand: the same clone with finish-ms.test.mjs as at 90aafe8a (the old evidence path) and the evidence
deleted fails 1 of 8, `not ok 7 - the verifier transcript of probe-plugin-agents-thread gives its real 4944`.

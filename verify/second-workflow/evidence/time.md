# time

At 46c5a010c6af19b6f20b0a9a97377c3a3900cddb: `node --test verify/second-workflow/time.test.mjs`, 10 pass. Rows are made by capture() from
plugins/harness/scripts/capture-rows.mjs out of UserPromptSubmit and Stop hook inputs, stamped a minute apart and
appended with the journal's append(); the view is `derive.js time --journal`. Each case: a turn, a 9-minute gap, the
wake under test and its turn.

Seen: a mention wake with a from="human" message (person.message row) -> person, 9 min; a decision-chosen wake
(person.tap) -> person; external-event wakes with check_run.completed and check_suite.completed -> ci. A coordinator's
relay (no wake envelope, a cited user message), a driver's `ccp-run it:0.brief` prompt, a GitHub pull_request.closed
event and a platform status wake with no person -> wake, person 0, ci 0. Old rows (reason prompt, no checkEvent) ->
wake. A sequence relay, mention, check_run -> [wake, person, ci], and the parts sum to wall time.

The same suite at origin/main 5630fbd5: 5 pass, 5 fail. This session's own journal (installed 0.1.42) shows the
problem live: the builder's relay to this thread was written as reason prompt, which main counts as the person.

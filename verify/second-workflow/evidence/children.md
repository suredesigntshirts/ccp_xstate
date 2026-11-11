# children

At 46c5a010c6af19b6f20b0a9a97377c3a3900cddb: `node --test verify/second-workflow/children.test.mjs`, 1 pass (about 4 s). Temp root, scratch git repo as cwd,
a GitHub REST stub on 127.0.0.1 given as CCP_GITHUB_API. Stub agents: each run is started and bound with the harness's
own spawn() and bind() (actors.js), then its result is written to the run's result.json, as the return hook stores
an accepted one; build results carry the stamped key (and green for two of them).

What it saw through bin/host.js alone (start, wake with a UserPromptSubmit hook input, card, closed, show, answer):
- start: planning, waiting [feat:0.brief]. The plan's result on one wake: slicing, three children feat:1.s1..s3 on
  quick-fix@..., each in briefing, waiting names each brief run with its item and its `ccp-run` prompt; each child's
  seq-0 input has its slice, base build/feat and decision { approve, by feature }.
- One wake hands all three briefs to their own children. A check_suite wake for s3's PR is offered to the top item
  (refused: not an event feature takes from outside) and every child (s1, s2 refused; s3 applied, checking ->
  verifying).
- Two PASS results in one wake: each child verify -> merge (engine) -> done, then top takes xstate.done.actor.s1 and
  .s2 (source item) in the same call. s3's PASS: s3 done and the feature moves to finishing and starts feat:4.final
  in that call. GitHub saw PUT /repos/o/r/pulls/11,12,13/merge at each verified sha.
- The final child asks (awaitingMerge, run feat:4.final:3.ask listed under its children entry). card on an effect
  outside the tree exits 2 ("is not a run of feat or of an open child item of it"); card on the child's ask records
  it. A check_suite wake on a new head moves the child to verifying with the ask's stop pending; closed finishes it
  and show lists no effect. A new PASS asks again (5.ask); answer before its card is refused ("not up yet"); after card,
  answer approve under a grant applies [ask (standin), merge (engine), top xstate.done.actor.final (item)] in one
  call: the feature is done, no child left, merge PUT at the new head.

The same suite at origin/main 5630fbd5: 0 pass, 1 fail.

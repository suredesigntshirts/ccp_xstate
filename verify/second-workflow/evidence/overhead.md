# overhead

At 46c5a010c6af19b6f20b0a9a97377c3a3900cddb: `node --test verify/second-workflow/overhead.test.mjs`, 11 pass. PR facts come from the real prFacts() over a
stubbed REST get (commits whose messages end in a Claude-Session trailer); token rows (turn.usage, agent.finish) are
appended with the journal's append(); the view is `derive.js overhead --journal --facts --config` (plan/** harness).

Seen: a trailer giving the URL, the bare session_ id, the URL with #agent=builder-2, or a local id; with rows keyed
by URL or by id (8 cases): prFacts keeps the trailer as written, unattributed 0, harness 750 / product 250 of 1000,
inputs.prs [o/r#7]. One session named three ways across two PRs plus a subagent's agent.finish: one session,
1000 tokens, both PRs, share 0.5. Old facts holding only session_X still attribute a URL-keyed session. A session no
trailer names stays unattributed (400), and a session whose id only starts with another's is not matched.

The same suite at origin/main 5630fbd5: 1 pass, 10 fail. Also re-run after the head moved from 783425d3 to 46c5a010c6af19b6f20b0a9a97377c3a3900cddb
(sessionKey now strips any URL prefix): 11 pass at both.

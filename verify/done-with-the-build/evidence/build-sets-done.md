# build-sets-done

Head: 807999f1362281bc882f39a584bbd20935748762. Command, from the checkout: `node --test verify/done-with-the-build/build-sets-done.test.mjs`.

Setup the test makes: a temp git repo holding copies of plan/, scripts/, packages/ and package.json; a commit on main
adds `plan/items/dwtb-probe.md`, this item's head under a new id at status ready with one world Expect line
(`plan/check.mjs` passes there). Branch build/dwtb-probe: first commit sets status done and done_on 2026-11-08 and
changes only the item file; second adds src/probe.txt; both carry a builder Claude-Session trailer. PR_BODY
`Item: dwtb-probe`, BASE_SHA the main commit. Then a commit with a different Claude-Session adds a complete
verify/dwtb-probe/verdict.json with verified_sha the builder's tip.

Seen:

    ✔ a build PR whose first commit sets its item done merges on a verdict from another session
    freeze: freeze gate passed (item dwtb-probe)
    before verdict: no verify/dwtb-probe/verdict.json at the head sha   (the only reason)
    after: verdict gate passed (item dwtb-probe)
    check: plan ok

The freeze gate also passes after the verdict commit.

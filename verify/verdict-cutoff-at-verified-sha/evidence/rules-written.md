# rules-written

Command: `node --test verify/verdict-cutoff-at-verified-sha/rules-written.test.mjs` and a read of the two files at 5005ddad872eb02941838cd88ceb900dbd7ef49a.

Excerpt (3/3 pass):
- docs/gates.md, verdict checks: "`verified_sha` is in the PR's history, no later commit other than a merge changes anything outside `verify/`, and the item's contract (see below) at `verified_sha` matches the head's, or the gate names the fields that moved;"
- docs/gates.md, The contract freeze: "A `done_on` set at the base moves only by such a replan whose item says why under `## Done on change`; setting one where there was none is free." ("such a replan": a PR labelled `replan` that changes nothing outside `plan/`.)
- docs/language.md, Plan: "| done_on change | The replan that moves an item's set `done_on`, saying why under `## Done on change` | `scripts/gates/lib.mjs` `checkDoneOn`, `docs/gates.md` |"

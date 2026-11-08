# done-on-held

Command: `node --test verify/verdict-cutoff-at-verified-sha/done-on-held.test.mjs` at 5005ddad872eb02941838cd88ceb900dbd7ef49a. An os.tmpdir() git repo
with a copy of scripts/gates/: base has item y (status done, done_on 2026-11-01), item z (doing, no done_on) and
src/a.js. Each case branches from the base, commits, and runs
`BASE_SHA=<base> PR_BODY= PR_LABELS=<labels> node scripts/gates/pr-gate.mjs freeze`.

Excerpt (8/8 pass):
- y to 2026-11-05, labels []: exit 1, "changes done_on of y from 2026-11-01 to 2026-11-05; a set done_on moves only by a PR labelled replan that touches nothing but plan/ and says why under ## Done on change".
- ["replan"] plus src/a.js, with a ## Done on change section: exit 1, same text ending "but this one touches src/a.js".
- plan-only ["replan"], no section: exit 1, "... which this one does not add or rewrite".
- plan-only ["replan"] removing done_on: exit 1, "from 2026-11-01 to (none)".
- plan-only ["replan"] whose base already has the section, unchanged: exit 1.
- plan-only ["replan"] gaining the section: exit 0; rewriting an existing section: exit 0.
- z gains done_on, labels [] and ["replan"]: exit 0 both.

Against origin/main 4d179d4: 3 pass, 5 fail (all five refusals).

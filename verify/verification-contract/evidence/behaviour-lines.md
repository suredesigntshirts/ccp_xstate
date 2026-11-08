# behaviour-lines

Command: `node --test verify/verification-contract/behaviour-lines.test.mjs` at 25dddc9 (VC_REPO=<checkout> to point at another).
Inputs: the head's plan/ copied to os.tmpdir(); a new item `vfy-pins` cloned from verification-contract.md with three
Expect lines, the middle one `pinned-line` holding "Every stage renders <phrase> the record" or "passes at <sha>".
Phrases from plan/decisions/2026-11-08-verification-swing.md decision 1, not from check.mjs.

Excerpt: 51/51 pass. Ready and doing: exit 1, e.g. `items/vfy-pins.md: Expect pinned-line pins main with "main's"; name
the behaviour to show instead (plan/README.md, How slop is kept out)`; shas a575897 and the 40-digit
25dddc9d…12bd refused with the sha named. Draft and done: exit 0. Upper case MAIN'S refused. A check naming
plan/README.md, docs/gates.md and scripts/gates/lib.mjs: exit 0. Against main a575897: 25 of 51 fail.

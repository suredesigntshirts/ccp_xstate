# cutoff-refused

Command: `node --test verify/verdict-cutoff-at-verified-sha/cutoff-refused.test.mjs` at 5005ddad872eb02941838cd88ceb900dbd7ef49a. Each case builds an
os.tmpdir() git repo holding a copy of scripts/gates/: base with item x (ready, one verifier Expect line, a Verifier
brief) and plan/items/other.md; build/x sets status doing and commits src/a.js plus verify/x/pass.test.mjs with a
builder Claude-Session (verified_sha), then verify/x/verdict.json with a different session. A side branch from the
base commits the case's change and is merged into build/x (`-X theirs`); then
`BASE_SHA=<side tip> HEAD_SHA=<merge> PR_BODY="Item: x" PR_LABELS=[] node scripts/gates/pr-gate.mjs verdict`.

Excerpt (7/7 pass):
- control, no side merge: exit 0.
- side rewords the Expect check: exit 1, "the contract of x moved after the verified sha 24f360d (expect); a verdict holds only for the contract it verified, so verify again at the head".
- side rewords the brief: exit 1, "... moved after the verified sha 24f360d (Verifier brief) ...".
- side changes only status (to done), only done_on, or only plan/items/other.md and plan/notes.md: exit 0 each.
- item file added by the side branch, so absent at verified_sha: exit 1, "plan/items/x.md does not exist at the verified sha fc9ec5a, so the verdict verified no contract of x".

Against origin/main 4d179d4 (VCV_REPO pointing at a worktree of it): 4 pass, 3 fail; the three refusals fail, the
control and the three exit-0 cases pass.

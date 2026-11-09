# same-answers

Command: node --test verify/batched-gate-reads/same-answers.test.mjs

Inputs: head 188c9b9620b4fa41fbe161cd921ed94bccf89fad; base pr-gate.mjs is main 829fa83b09c94f6955bc6da982ba0e750cf64041's,
kept beside this file as base-pr-gate.mjs.txt (ci's depth-1 checkout has no base commit) and run next to the head's
lib.mjs, which the PR does not change. Each case is a temp repo whose base commit is `git archive HEAD plan scripts
packages plugins verify` of the checkout, then the PR's commits; both scripts run each of freeze, stubs, evidence and
verdict with BASE_SHA, HEAD_SHA, PR_BODY and PR_LABELS set, and the test compares exit code, stdout and stderr.

Excerpt: 8 pass at the head (62 s, git 2.43 here). The PR shapes: a done, verified item's Expect softened plus a done
item's done_on moved (also as a plan-only replan); items added, and a draft, a done and a verified item deleted; a
verdict file deleted, alone and with its item set back to ready; paths with spaces, a double quote, non-ASCII, and
names ending " missing" and " ambiguous", in packages/, scripts/inspector/, verify/ and plan/items/ (two done items
named that way at the base); a PNG-like binary with NUL and invalid UTF-8 bytes in packages/, scripts/ and verify/, a
70 KB file, a .pass file, a spec-reporter listing, symlinks, gitlinks in packages/ and verify/, and a folder named
plan/items/folder.md; stubs added in scripts/bench/, packages/ and plugins/ and removed again; a verdict from a
separate session, rewritten by the builder, then a late commit; and the PR's own diff over the real plan.

Bite (each mutation applied to the head's pr-gate.mjs in place, then restored):
- the reader keeps git's trailing newline (no trimEnd): 8 of 8 fail;
- a tree or other non-blob reads as missing instead of falling back to git show: 1 fails (the plan/items/folder.md case);
- blob text decoded as latin1 instead of UTF-8: the binary/listing case fails (the spec-reporter marks no longer match);
- `header === spec + ' missing'` replaced by `header.endsWith(' missing')`: 8 pass. This mutation is equivalent: git
  prints a present object as `<sha> <type> <size>`, never with the requested name, so a name ending in " missing"
  cannot be misread either way. The item's risk holds by construction.

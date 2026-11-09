# guards-pass

Command: in a fresh clone at 188c9b9620b4fa41fbe161cd921ed94bccf89fad after npm ci, clean HOME:
node --test "scripts/gates/test/*.test.mjs" "test/regression/gates/*.test.mjs"

Excerpt: tests 175, pass 175, fail 0, in each of three runs (see faster.md). `git diff --stat
829fa83b..188c9b96` lists only plan/items/batched-gate-reads.md and scripts/gates/pr-gate.mjs, so no guard was changed,
skipped or removed.

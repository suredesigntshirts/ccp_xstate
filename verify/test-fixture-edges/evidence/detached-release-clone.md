# detached-release-clone

Command: `node --test verify/test-fixture-edges/detached-release-clone.test.mjs`, at af64a367c242b66cf968aad168b40e5141d029a3.

Inputs: two `git clone` copies of the checkout in `$TMPDIR/verify-tfe-*`; in each `git checkout --detach`, an empty
commit, `git branch release/harness-v9.9.9` (the only ref at that commit). The base copy first applies
`verify/test-fixture-edges/to-base.diff` (the reverse of the build for its four code files) and commits it. Then
`node --test --test-reporter=tap test/setup.test.mjs verify/self-update-by-version/no-self-edit.test.mjs` in each.

Excerpt (run in a depth-1 clone, PATH without strace):

```
ok 1 - at the head every copy-not-link and no-self-edit test passes, none skipped
# pass 12 fail 0 skipped 0
ok 2 - with the build change taken out, a copy-not-link and a no-self-edit test fail on HEAD
# pass 5 fail 7 skipped 0; failed: copy-not-link: with release tags, setup installs the newest release by version, not the HEAD | no-self-edit: setup.sh run beside a live Claude Code in the same HOME writes nothing under the plugin root | ... (all 6 no-self-edit)
```

The base output also holds "Failed to resolve 'HEAD'", which the test asserts.

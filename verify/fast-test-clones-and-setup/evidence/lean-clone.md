# lean-clone

Command: `node --test verify/fast-test-clones-and-setup/lean-clone.test.mjs`, at be40cff22a443e1d5be0f9dd0ac1cce00837e00b, in a fresh depth-1 clone of the
PR branch (as ci checks out) and in a full clone; clean HOME.

Excerpt: 2 pass. Source the checkout, and source a bare clone of it with one extra tag: in both, the lean clone and a
plain `git clone` have the same `git ls-files` (9,794), the same `rev-parse HEAD` (be40cff22a443e1d5be0f9dd0ac1cce00837e00b), `branch -a`, `tag`,
every ref and its object, and the same commit count; the lean clone has 931 files on disk, exactly the tracked files
outside bench/ and tournaments/, and `git status --porcelain` is empty.

Inputs: temp dirs vftc-lean-*, vftc-bare-* (removed on exit); no environment set.

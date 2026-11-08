# released-named-once

At 924f822ee0f1bac754fe1e8edbaf89a3328d6a74: `node --test verify/after-verdict-gaps/released-named-once.test.mjs`, 2/2 pass.

- plugins/harness/README.md, Releases: "changes what a session runs: a path in `RELEASED` in that script." No
  released path is listed before "The thread that merged" (a later line says packages/journal is bundled at
  lib/journal, which is where the copy puts it, not what is released).
- Temp repo (made in os.tmpdir(), GIT_CONFIG_GLOBAL=/dev/null, commit.gpgsign=false): first commit with the four
  included paths, branch release/harness-v0.1.0 on it, second commit touching docs/other.md and the excluded
  plugins/harness/test/. plan({ cwd }) returns release false, changed [], reason "nothing under plugins/harness,
  packages/journal, packages/engine/src, packages/engine/messages.md changed since harness-v0.1.0".

With main's release.mjs the reason misses packages/engine/messages.md and the test goes red.

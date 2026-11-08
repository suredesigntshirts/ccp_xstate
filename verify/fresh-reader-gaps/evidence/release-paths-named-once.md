# release-paths-named-once

`node --test verify/fresh-reader-gaps/release-paths-named-once.test.mjs` at build head `7d35231e`: 4/4 pass.

- `scripts/release/release.mjs:29`: `RELEASED = ['plugins/harness', 'packages/journal', 'packages/engine/src',
  'packages/engine/messages.md', ':(exclude)plugins/harness/test', ':(exclude)packages/journal/test']`.
- docs/gates.md, After the merge: "The thread that merged runs `git fetch origin main && node
  scripts/release/release.mjs branch --push`: it pushes `release/harness-v<x.y.z>` if the merge changed a path in its
  `RELEASED`, else nothing (`plugins/harness/README.md`)."
- plan/README.md step 4 ends "Then run the release command (`docs/gates.md`, "After the merge"). No PR follows."
- Lines naming `plugins/harness/` (other than its README) or `packages/journal/`: 0 in docs/gates.md, 0 in
  plan/README.md. At main both files listed `plugins/harness/` or `packages/journal/` as the released paths.

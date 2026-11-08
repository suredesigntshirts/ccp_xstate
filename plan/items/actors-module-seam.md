```json
{
  "id": "actors-module-seam",
  "title": "Move importers off actors.js to the modules that own what they use",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "module": "packages/engine/src/actors.js",
  "outcome": "actors.js re-exports nothing; every importer of a run store, worktree, accept or supervise function imports that module; actors.js holds only what no run/ module owns; and packages/engine/README.md describes the engine's entry points in about 150 lines.",
  "why": "run-lifecycle-store split actors.js into run/ modules but kept the re-exports, so 51 files still import the facade and the split is not enforced (deep modules; research plan/research/verification-swing.md, item 8).",
  "serves": [
    "L-count-concepts"
  ],
  "depends_on": [
    "run-message-and-budget"
  ]
}
```

Draft from `plan/research/verification-swing.md`, item 8. Names `packages/engine/src/actors.js` as its module. The
README length is a target in the outcome, not an Expect line; the Expect lines will say what the README must
explain, and the verifier reads it.

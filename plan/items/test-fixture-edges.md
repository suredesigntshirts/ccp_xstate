```json
{
  "id": "test-fixture-edges",
  "title": "Close three test-fixture edges the self-edit check left",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "The copy-not-link and no-self-edit clones pass when the source checkout has a local release/harness-v branch at its detached HEAD; scripts/debug/trace-writes.mjs --keep works when the kept path is on another file system; and the capture hook's p95 bar measures what capture adds over a bare node start, as its median does, so a busy runner does not fail it.",
  "why": "The verifier of self-edit-check-snapshot noted two edges (verdict notes 2 and 3), and its verdict head's ci failed once on capture.test.mjs's absolute 200 ms p95 (514 ms) once the no-self-edit tests stopped skipping on CI (L-attention-is-the-constraint).",
  "serves": [
    "L-attention-is-the-constraint"
  ],
  "depends_on": [
    "self-edit-check-snapshot"
  ]
}
```

Draft from the self-edit-check-snapshot verdict and its CI. Edges, each small:

- A clone of a checkout whose detached HEAD has a local `release/harness-v*` branch at it checks that branch out;
  the test then deletes it and `git` fails with "Failed to resolve 'HEAD'". `git -C <clone> checkout -q --detach`
  before deleting the refs closes it, in `test/setup.test.mjs` and in no-self-edit's `world()`.
- `--keep` renames the trace out of `os.tmpdir()`, which fails with EXDEV across file systems; copy then remove.
- `plugins/harness/test/capture.test.mjs` compares p95 (over 5 samples, so the maximum) with an absolute 200 ms.
  Measure it over a bare node start, as the median is
  (`plan/decisions/2026-10-30-capture-cheap-measures-what-capture-adds.md`).

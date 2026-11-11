```json
{
  "id": "fix-gate-reads-renames",
  "title": "Make the verdict gate see both sides of a rename",
  "stage": "s5-parity",
  "kind": "build",
  "status": "merged",
  "outcome": "The verdict gate reads a renamed file under both its old and new path, so a PR that names no item and renames a file from outside plan/ and the notes files into them is refused naming the old path.",
  "why": "Merged into refine-leftovers 2026-11-11: a one-flag gate fix does not pay for its own builder and verifier (plan/decisions/2026-11-11-triage.md). memory-boundary's verifier found on 9 Nov that a pure rename of docs/gates.md to docs/verifying.md passes the verdict gate with no item, because git diff --name-only lists only the new name; a rename into plan/ passes the same way on main (verify/memory-boundary/verdict.json observations).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "memory-boundary"
  ],
  "merged_into": "refine-leftovers"
}
```

Draft. The likely fix is `--no-renames` on the changed-file list in `scripts/gates/pr-gate.mjs`, as the evidence gate
already does, with a guard for both rename directions.

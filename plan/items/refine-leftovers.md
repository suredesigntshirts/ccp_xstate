```json
{
  "id": "refine-leftovers",
  "title": "Close the small gaps the refine rounds' verifiers left",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "No comment in scripts/release/release.mjs names a plan item; workflows/quick-fix/build.md describes pr as the { url, at } its output section gives; the inspector page wraps a long hash in a section's paragraphs; the regression-folder guard sees a verify/ path built with resolve() or a template, a clone made through any helper, and setup.sh reached through an imported constant; the rule that a nested run's environment comes from childEnv is checked in helper .mjs files beside the tests too; own-traps-in-code's failing docs-point check is retired into test/regression/ as a check by meaning; and the verdict gate reads a renamed file under both its old and new path, so a PR that names no item and renames a file from outside plan/ and the notes files into them is refused naming the old path.",
  "why": "Verifiers of the refine rounds, the memory audit of 9 Nov and the own-traps-in-code and memory-boundary verdicts each left a small defect on main: a comment that breaks the comment rule, a stage text that contradicts itself, a page that overflows, guards that miss cases, a frozen check that fails, and a verdict gate a rename slips past (L-rules-live-in-the-repo). Trimmed 2026-11-11 to the defects, with fix-gate-reads-renames merged in (plan/decisions/2026-11-11-triage.md).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "after-verdict-gaps",
    "memory-boundary"
  ]
}
```

Draft written at the end of the refine rounds (8 Nov) so their leftovers live in the plan, not in a thread, and
trimmed on 11 Nov to the defects still on main (`plan/decisions/2026-11-11-triage.md`).

- **The release comment.** `RELEASED`'s doc comment in `scripts/release/release.mjs` still says "since engine-actors"
  and "plan item prompt-catalogue" (`CLAUDE.md`, "Comments say what holds now").
- **Long hashes in the inspector.** `scripts/inspector/page.html` wraps `.panel p` and `td` but not a section's
  paragraphs (`details.sec>.inner p`), so a long hash overflows and every artifact refresh patches the published copy.
- **The build stage's pr wording.** `workflows/quick-fix/build.md` says "Never put anything but the PR's url in pr",
  while its output section makes pr `{ url, at }`.
- **Regression-folder guard misses.** The guard does not see a `verify/` path built with `resolve()` or a template,
  a clone made through a helper other than `leanClone`, or `setup.sh` reached through an imported constant.
- **Nested runs in helper files.** The rule that a child's environment comes from `childEnv` is checked in test
  files only; a helper `.mjs` beside them can still drop `NODE_TEST_CONTEXT` itself.
- **A frozen one-line check.** own-traps-in-code's `docs-point` proof checks that `docs/verifying.md` names
  `scripts/fresh-reader.mjs` on one line; the file now names it on two, so that frozen suite fails (it is not in
  `npm test`). Retire the suite into `test/regression/` with a check by meaning.
- **Renames past the verdict gate.** memory-boundary's verifier found that a pure rename of `docs/gates.md` to
  `docs/verifying.md` passes the verdict gate with no item, because `git diff --name-only` lists only the new name; a
  rename into `plan/` passes the same way. The likely fix is `--no-renames` on the changed-file list in
  `scripts/gates/pr-gate.mjs`, as the evidence gate already does, with a guard for both rename directions.

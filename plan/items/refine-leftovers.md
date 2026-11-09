```json
{
  "id": "refine-leftovers",
  "title": "Close the small gaps the refine rounds' verifiers left",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "No comment in scripts/release/release.mjs names a plan item; the step-2 checks in verify/fresh-reader-gaps fail when step 2 negates the verifier ask; docs/layout.md's Tests rule says a test matching a rule text collapses whitespace first, so a term wrapped across a line break still matches.",
  "why": "Verifiers of refine rounds 7, 8 and 10 noted each of these on 8 Nov without failing a line (observations in verify/verifier-reader-gaps, verify/rule-text-tests and verify/after-verdict-gaps verdict.json); left alone, the comment rule is broken in one file and two rule-text tests are weaker than they read (L-rules-live-in-the-repo).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "after-verdict-gaps"
  ]
}
```

Draft written at the end of the refine rounds (8 Nov) so their leftovers live in the plan, not in a thread.

- **The release comment.** `RELEASED`'s doc comment in `scripts/release/release.mjs` still says "since engine-actors"
  and "plan item prompt-catalogue" (`CLAUDE.md`, "Comments say what holds now").
- **The loosened step-2 checks.** Round 7 loosened `verify/fresh-reader-gaps/fresh-reader-path.test.mjs` so a
  rewording stays green; it now passes a step 2 that says the builder "never asks for a verifier". That suite is
  frozen, so the fix is a new check in this item's verifier suite, or the suite leaves with `verify-regression-set`.
- **Terms across line breaks.** Round 8's rule (`docs/layout.md`, Tests) says to match each carrying term on its own,
  but a two-word term such as `first commit` wrapped across a line fails a plain regex. The rule gains: collapse
  whitespace before matching.

From the memory audit of 9 Nov (section D) and the own-traps-in-code verdict, each still present on main then:

- **Long hashes in the inspector.** `scripts/inspector/page.html` wraps `.panel p` and `td` but not a section's
  paragraphs (`details.sec>.inner p`), so a long hash overflows and every artifact refresh patches the published copy.
- **The build stage's pr wording.** `workflows/quick-fix/build.md` says "Never put anything but the PR's url in pr",
  while its output section makes pr `{ url, at }`.
- **Regression-folder guard misses.** The guard does not see a `verify/` path built with `resolve()` or a template,
  a clone made through a helper other than `leanClone`, or `setup.sh` reached through an imported constant.
- **Nested runs in helper files.** The rule that a child's environment comes from `childEnv` is checked in test
  files only; a helper `.mjs` beside them can still drop `NODE_TEST_CONTEXT` itself.
- **Artifact generators outside the repo.** The scripts that build the person-facing pages (the prompts page, the
  quick-fix machine map, the inspector's source configs) live only in `/mnt/project-files`. Decide whether they move
  into `scripts/`.

Considered with these and not taken yet, each noted in its round's decision file:

- `plan/README.md` says a contract cannot change once any verdict file exists; the freeze gate checks the PR's own
  base and head, so a separate replan PR could still change it. Decide which is the rule (round 10, Not taken).
- Nothing says where the `Claude-Session` value comes from, or the order of commit trailers (round 9, Not taken).
- Done items' frozen suites pin whole sentences of the entry texts, so every rewording edits another item's
  `verify/` folder. `verify-regression-set` retires those folders; a Verifier-brief rule to match meaning, not
  sentences, would stop new ones (observation in `verify/verifier-reader-gaps/verdict.json`).

The entry texts stand at 223 of the 225-line budget (`test/docs.test.mjs`), so any added line pays for itself.

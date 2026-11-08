# Readying plan-reader-effort

**Date:** 2026-11-08
**Decided by:** the builder thread, as stand-in (two-way doors).
**Item:** `plan/items/plan-reader-effort.md`, from `plan/research/verification-swing.md`, item 7.

## 1. A script, not a derived view

`scripts/reader-effort.mjs`. The numbers come from git, and `packages/journal/src/derive/` reads the journal, so a
derived view would have to shell out to git anyway. A script is one file with no new dependency, and it can be run on
any range, merged or not.

## 2. Five categories, by path

Each changed path falls in the first rule it matches:

1. **evidence:** under `verify/` and not a `.js` or `.mjs` file (verdicts, evidence files, fixtures).
2. **verifier:** under `verify/`, a `.js` or `.mjs` file.
3. **tests:** a `*.test.js` or `*.test.mjs` file, or any path with a `test/` or `fixtures/` folder in it.
4. **docs:** a `.md` file, except stage files under `workflows/` and `packages/engine/messages.md`, which are text
   handed to a model and so behave like code.
5. **code:** everything else.

These are the review's split (code, unit tests, verifier tests, evidence, docs) with the review's own ambiguities
settled. Renames count as a delete and an add (`--no-renames`), so a moved file costs what a reader pays to find it.

## 3. Reader lines

The lines a reader must open: every added or removed line in code, tests, verifier and docs, plus, once each, the
line span of every top-level function a changed code, test or verifier line calls and that the head defines in a
file the change did not add it to. A definition is `function name(` or `const name =` at the top level, optionally
exported; its span runs to the first closing brace in column 0, or is one line when the definition closes on its own
line. Evidence lines are left out: nobody reads them to follow the change, and they are reported on their own.

This is a heuristic, not a call graph. It is cheap, it reads only git, and it moves the way a reader's effort moves.
A better one replaces it when a review shows it misleading.

## 4. Exports

For each changed code file, the exported names at the base and at the head (`export function`, `export const`,
`export class`, `export default`, the names in `export { ... }`). Added and removed are the set differences. Test and
verifier files are not counted: their exports serve only their own suites.

## 5. The head field and its cutoff

`reader_effort` sits beside `module` and `done_on`: integers only (`pr`, `files`, `exports_added`,
`exports_removed`, `reader_lines`, and `added` and `removed`, each an object of the five categories). The done
replan pastes the command's `--json` output. `plan/check.mjs` refuses a done build item with `done_on` on or after
2026-11-09 that lacks it. Earlier items are not backfilled: forty-one done build items have no `done_on`, and
reopening their heads buys nothing a later review needs.

Recording it is not a contract change: `scripts/gates/lib.mjs` `contract()` leaves it out of the frozen head with
`status` and `done_on`, because it says what the build cost, not what it must show.

## 6. No gate on the numbers

The report measures; it refuses nothing. A ceiling (say, reader lines per concept added) is a later decision, once
a few items' numbers show what normal looks like.

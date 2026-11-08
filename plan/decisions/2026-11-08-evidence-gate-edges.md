# evidence-gate-edges: how the evidence gate tells a link and a listing (2026-11-08)

Claude's two-way-door choices as stand-in for the person, made when readying `evidence-gate-edges` from the plan
verifier's observations 1 and 2 on `verify-evidence-policy` (PR #197).

## 1. Anything under verify/ that is not a regular file is refused

The gate reads each kept path's mode from `git ls-tree` at the head. A mode other than `100644` or `100755` is
refused, naming the path and what it is: `120000` a symlink, `160000` a submodule. A link's blob is its target's
name, so its size says nothing about what it points at; a submodule's object is not in the repo at all, so
`git cat-file -s` on it fails today and the gate crashes rather than refusing. Refusing every non-regular entry is one
rule instead of two, and evidence never needs either.

Not adopted: following the link and measuring its target. A link inside the tree still lets a later change grow the
target without touching `verify/`, and a link out of the tree points at nothing on the runner.

## 2. A test listing is told by its text: a summary and ten result lines

A file under `verify/` is a test listing when its text holds both a pass and a fail summary line of node:test
(`# pass 3` and `# fail 0` in TAP, `ℹ pass 3` and `ℹ fail 0` in the spec reporter, indented or not) and at least
`LISTING_LINES` (10) result lines (`ok 1 - name`, `not ok 2 - name`, `✔ name`, `✖ name`, indented or not). Both
reporters count because a listing is saved from either: piped output is TAP, a terminal's is spec.

The count, not a share of lines, decides. The evidence files on main quote at most four result lines with their
summary; a TAP listing of ten tests has ten result lines among about seventy, so a share would need a low bar that a
short excerpt also crosses. Ten lets an excerpt quote the lines that matter and refuses a listing of any suite worth
archiving. A listing of fewer than ten tests passes the gate; it is the verifier's brief, not the gate, that keeps
those out, and the docs say so.

The rule reads every kept file under `verify/`, test files included, so a verifier's test that needs a listing as a
fixture builds it in code rather than writing ten literal `ok` lines at the start of lines.

## 3. The .pass rule stays

A `*.pass` name is still refused at any size. It costs one line and names the habit the policy was written against.

## 4. Docs keep their line count

`CLAUDE.md`, `plan/README.md` and `docs/gates.md` total 229 lines against the 230 budget, so the build rewraps the
gate's table row and the Evidence paragraph in `docs/gates.md` to say what is refused and what stays the verifier's,
and changes the README's evidence sentence in place, adding no line. `docs/language.md` gains `test listing`.

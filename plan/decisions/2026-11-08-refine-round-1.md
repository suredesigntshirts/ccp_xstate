# Refine round 1: one home per rule, and the Item line names the item (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, who asked on 8 Nov 09:56Z for recurring refine rounds:
make the harness's process and instructions simpler, more concise and clearer each round, using the three concept
summaries they attached (Ousterhout's *A Philosophy of Software Design*, Hunt and Thomas's *The Pragmatic
Programmer*, Evans's ubiquitous language and DDD). This file records round 1; each later round adds its own file.

## 1. Which book concepts the rounds use, and why

The yardstick is what a model reads before it acts. The rule texts are an interface; a thread is the caller.

| Concept | Source | Used for |
|---|---|---|
| DRY as knowledge, single source of truth | Pragmatic Programmer | Each process rule has one home; other texts point at it. Two copies drift (L-expect-format-one-owner) |
| Deep modules; make common usage simple; overexposure | Ousterhout | `CLAUDE.md` is the short interface (the map and the principles); the mechanics sit behind it in `docs/gates.md`. A thread on the common path reads the path, not every gate's internals |
| Define errors out of existence | Ousterhout | Change the gate so the written rule cannot trip it, instead of documenting the trap |
| Information leakage | Ousterhout | The same rule written in two files is one decision in two places |
| Ubiquitous language | Evans | Rule texts use `docs/language.md`'s words; a term a rule needs is added there first |
| Frozen language | Evans | Tests that match rule sentences by regex freeze the wording; they leave, and what they guarded that is behaviour (paths real, file short) becomes a repo test |
| Broken windows; automation | Pragmatic Programmer | A test keeps the texts' paths real and their length inside a budget, so rot is caught by CI, not by the next reader |
| Complexity is what the reader experiences | Ousterhout | Measured as lines a thread must read before its item; the budget is a ratchet later rounds lower |

Left out, and why:

- **Design it twice** for prose rules. A rule text is cheap to change and is checked by a fresh reader; the
  tournament kit is for code designs and stays with design items (fix budget).
- **Bounded contexts, context maps, aggregates, distillation.** `docs/language.md` already splits the four
  contexts and their meeting points; nothing in round 1 strains them.
- **Comments-first, comment rules.** `comments-present-tense` already holds them, with a gate.
- **Tracer bullets, estimating, concurrency, actors, performance.** The system runs end to end; none of these is the
  current constraint on how clearly a model knows what to do.
- **Deep modules in the engine code** (`actors.js` facade, the run's one message and one budget). Already filed as
  `actors-module-seam` and `run-message-and-budget` in the verification swing; this series does not take them over.

## 2. Model-facing stage files wait for the stage bench

The stage files under `workflows/` are what a model in a workflow reads. They change only with a stage-bench run
showing the change helps (L-stage-needs-bench, `docs/prompts.md`), and until the regression set lands a workflow edit
breaks six frozen snapshot suites. Round 1 changes the texts a thread reads to build the harness, not the stage
files. A later round takes one stage file with a bench comparison.

## 3. The homes

- `CLAUDE.md`: the map and the principles, one line each with a pointer to its home.
- `plan/README.md`: the plan as data (layout, the item head, splicing, status, the fix budget), the path an item takes
  from ready to done, and the rules of "How slop is kept out" in a sentence each.
- `docs/gates.md`: how each gate checks those rules: the verdict file, the contract freeze, sessions, the release.
- The deny-list of phrases that pin main lives in `plan/check.mjs`; texts name it there, not in a decision file.

## 4. A PR names its item by its Item line alone

Before: the gate took the item from an `Item:` line or from the branch's last segment, and refused when both named
different items. `CLAUDE.md` told threads to call a replan branch `replan/<item-id>`, which made the gate read the
item and demand a verdict, so threads named replan branches `replan/<id>-done` from memory. Now the body line alone
names the item. Branch names stay a convention for people (`<kind>/<item-id>`, no `claude/` prefix) and nothing reads
them. One way to name a thing, and the error case (a branch disagreeing with the body) is gone.

Not adopted: reading the branch only when its first segment is an item kind. It keeps two ways to name an item and a
list of kinds the gate must know.

## 5. The line budget

`CLAUDE.md`, `plan/README.md` and `docs/gates.md` together stay under 230 lines, held by `test/docs.test.mjs`. The
number is what round 1's build needs, not a target; a later round that shortens the texts lowers it, and an item that
must raise it says why in its prose.

## 6. Which done-suite tests leave

`verify/repo-skeleton/claude-md.test.mjs`, `verify/verification-contract/rules-written.test.mjs`,
`verify/fix-budget-rule/rule-written.test.mjs`, the `claude-md` test in `verify/harness-glossary/notes.test.mjs`, and
the `plan/README.md` test in `verify/verify-evidence-policy/policy-written.test.mjs` (its `docs/gates.md` test stays,
since that file is the evidence policy's home). Each matches sentences of the rule texts and would fail on any
rewrite. They are on `verify-regression-set`'s and `verify-regression-plugin`'s known-deletion lists already; this
item removes them first, and those items' tables mark them gone.

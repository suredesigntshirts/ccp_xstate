# Fix budget: when repeated fixes to one module start a design item (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of `fix-budget-rule`
(research `plan/research/design-books-cleanup.md`, finding 8; the person's go for all eight cleanup items, 7 Nov).

## The rule

A `fix-` item names the one module its main change lands in. When three fix items naming the same module were done
in the last 14 days, and no design item for that module was done after them, the plan check refuses a fourth fix item
there at `ready` or `doing`. The next item there is a design item instead: it names the concept that keeps breaking
(in `concepts`) and designs it twice, with the tournament kit (`docs/tournaments.md`). Once it is done, the count for
that module starts again.

"A third fix makes the next item a design item" (the draft's outcome) means three fixes are allowed and the fourth is
refused. Counting only done items keeps the check reading facts the plan already settles; a fix that is still being
built does not count until it is done.

## The check enforces it, not prose

The README rule alone would be one more thing a builder remembers. `plan/check.mjs` already runs on every PR in CI,
so the rule lives there, which matches "each rule is enforced by something other than the builder". That makes this a
build item (it changes `plan/check.mjs`), so its kind moves from decision to build. It still ships nothing in the
plugin: `plan/` and `test/` only, so no release.

## Two head fields

- `module`: a repo path, a file or a folder, compared as a string. On a `fix-` item it is the module the fix changes;
  on any other item it is the module that item redesigns. A fix item at `ready`, `doing` or `done` must name one; at
  `ready` or `doing` the path must exist. One path, not a list: a fix that lands in several files names the one its
  outcome is about. Exact string comparison is crude (a folder and a file in it are two modules), but it needs no
  rules about nesting, and the builder picks the path the next fixer will also pick.
- `done_on`: the date (YYYY-MM-DD) the item became done. An item at `done` that names a module must carry it; the 14
  days count back from the day the check runs.

The window uses the day the check runs, so a PR's result can change over time, but only towards passing: fixes age
out of the window, and nothing ages in.

## Backfill

The replan that readies this item fills `module` and `done_on` on every done fix item, and on `run-lifecycle-store`,
the item that redesigned `packages/engine/src/actors.js` (finding 4 called it "the module the 11-05 fixes kept
patching"). Done heads are frozen, so only a replan PR may add them. Each `done_on` is the date of the commit that
first set the item's status to done (`git log -S'"status": "done"'`). Each `module` is the first source file the
item's `outputs` name, except `fix-waiting-wake` (`workflows/quick-fix.json`, where its timer lives) and
`fix-workflow-pinned`, which names no outputs (`packages/engine/src/host.js`, which records and checks the pin).

What the backfill shows: seven fixes to `packages/engine/src/actors.js` on 11-05, so the rule would have stopped the
fourth; `run-lifecycle-store` (done 11-07) is the design item that restarts its count. Three fixes to
`packages/engine/src/host.js` on 11-05 have had no design item, so until 11-19 a fourth host.js fix is refused, and
the verifier's world check uses exactly that.

`fix-budget-rule` itself is a `fix-` item by its id; it names `plan/check.mjs`, which no other fix item names.

## Not adopted

- Counting commits or files touched instead of items. Commits are the wrong grain (one item has many), and outputs
  list tests and docs beside the module, so they over-count.
- A per-module allowance in a config file. One number (three in 14 days) is the research's, and a second knob is a
  concept nobody asked for.
- Checking that the design item really "designs it twice". The plan check cannot see a tournament; the item's prose
  and its verifier do.

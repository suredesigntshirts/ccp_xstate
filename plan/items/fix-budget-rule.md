```json
{
  "id": "fix-budget-rule",
  "title": "Decide when repeated fixes to one module start a redesign item",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "module": "plan/check.mjs",
  "outcome": "plan/README.md states the fix budget and plan/check.mjs enforces it on every PR: a fix- item at ready, doing or done names the module it changes, a done item that names a module carries done_on, and once three fix items naming one module were done in the last 14 days with no design item for that module done after them, a fourth fix item there is refused at ready or doing, by name, pointing at a design item that names the recurring concept and designs it twice (plan/decisions/2026-11-08-fix-budget-rule.md).",
  "why": "Step back counts rounds within one item, but nothing counts fixes across items; 76 of 148 main commits since 11-04 are fixes, and seven fix items on 11-04 and 11-05 changed packages/engine/src/actors.js before anyone looked at its shape (APOSD strategic programming; research plan/research/design-books-cleanup.md, finding 8).",
  "serves": [
    "L-count-concepts",
    "L-replan-after-second-fail"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 8: the smell, the evidence and the change"
    },
    {
      "ref": "plan/decisions/2026-11-08-fix-budget-rule.md",
      "what": "The rule (three allowed, the fourth refused), the two head fields, the window counted from the day the check runs, the backfill and what it shows, what is not adopted"
    },
    {
      "ref": "plan/check.mjs, plan/item.schema.json",
      "what": "The plan check and the head schema, which the replan already gave module and done_on"
    },
    {
      "ref": "plan/README.md, CLAUDE.md",
      "what": "How an item is written, the check list, and the step-back principle"
    }
  ],
  "outputs": [
    {
      "ref": "plan/check.mjs",
      "what": "Three rules: a fix- item at ready, doing or done names module, and at ready or doing that path exists; a done item naming module carries done_on; a fix- item at ready or doing whose module has three or more done fix items with done_on within 14 days of today, none before a later done non-fix item naming the same module, is refused with a message naming the module, those fix items and plan/README.md, Fix budget"
    },
    {
      "ref": "plan/README.md",
      "what": "A Fix budget section stating the rule and what the design item does; the head-field table and the check list name module and done_on"
    },
    {
      "ref": "CLAUDE.md",
      "what": "The step-back principle also points at the fix budget (file stays under 100 lines)"
    },
    {
      "ref": "docs/language.md",
      "what": "Lines for fix budget and design item"
    },
    {
      "ref": "test/plan-check.test.mjs",
      "what": "The builder's tests: each rule on a temp copy of plan/, with dates relative to today"
    }
  ],
  "expect": [
    {
      "id": "rule-written",
      "check": "plan/README.md has a Fix budget section stating: a fix- item names its module; three done fix items to one module in 14 days with no design item after them refuse a fourth; the next item is a design item that names the recurring concept (concepts) and designs it twice; its completion restarts the count. CLAUDE.md points at it and stays under 100 lines; docs/language.md defines fix budget and design item",
      "how": "The verifier reads the three files",
      "proof": "verifier"
    },
    {
      "id": "names-module",
      "check": "Run on a temp copy of the head's plan/, check.mjs refuses (exit 1, naming the item and the field) a fix- item at ready, at doing and at done without module; a ready fix- item whose module path does not exist; a done item naming a module without done_on. A draft fix- item without module, and a non-fix item without module, pass",
      "how": "The verifier's own tests copying plan/ to a temp folder and editing item heads",
      "proof": "verifier"
    },
    {
      "id": "budget-refuses",
      "check": "In a temp copy: three done fix items naming module M with done_on in the last 14 days and a ready fix item naming M is refused, the message naming M, the three fix ids and plan/README.md; the same item at doing is refused; with two such fixes it passes; with one of the three done 15 days ago it passes; a done non-fix item naming M with done_on after the three makes it pass; one dated before them does not; a ready non-fix item naming M passes (it is the design item)",
      "how": "The verifier's own tests on a temp copy, dates computed from today",
      "proof": "verifier"
    },
    {
      "id": "backfill-true",
      "check": "At the head every done fix- item names module and done_on; each done_on is the date of the commit that first set that item's status to done; each module is one of the item's outputs, or the decision file's named exception; run-lifecycle-store names packages/engine/src/actors.js",
      "how": "The verifier's own script over plan/items with git log -S at the head",
      "proof": "verifier"
    },
    {
      "id": "world-refuses",
      "check": "A throwaway PR in ccp_xstate based on the head (closed unmerged, branch deleted or left named throwaway) that adds one ready fix- item naming packages/engine/src/host.js fails the ci check on GitHub at its plan check step, and the log names packages/engine/src/host.js and fix-finish-closes-waits, fix-other-host-runs-effects and fix-workflow-pinned. Valid through 2026-11-18; on 2026-11-19 those fixes leave the window",
      "how": "The PR and its ci run on GitHub",
      "proof": "world"
    },
    {
      "id": "tests-bite",
      "check": "test/plan-check.test.mjs goes red when the budget count in check.mjs is broken (for example the 14 days changed to 0, or the design-item reset removed), and green again when restored",
      "how": "The verifier breaks check.mjs and runs the test",
      "proof": "builder"
    },
    {
      "id": "current-as-main",
      "check": "node plan/check.mjs passes on the head's real plan; every test that passes on main passes at the head; the PR changes only plan/check.mjs, plan/README.md, CLAUDE.md, docs/language.md and test/plan-check.test.mjs; no verify/ folder of another item changes",
      "how": "The verifier runs the plan check, the tests that read changed files (test/, verify/harness-glossary) and reads the diff; CI's full suite at the head",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The checks run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "fix budget (three done fix items to one module in 14 days refuse a fourth until a design item for it is done)",
      "design item (a non-fix item naming the module it redesigns; it names the recurring concept and designs it twice)"
    ],
    "merges": [],
    "removes": [],
    "budget": 2
  },
  "non_goals": [
    "No plugin or engine change, so no release",
    "The check does not judge whether a design item really designs twice: its prose and verifier do",
    "No per-module allowance or config: one number, three in 14 days",
    "Draft items are not counted or checked for module",
    "No backfill beyond the replan: done heads are frozen"
  ],
  "records": [
    "None: the plan check prints its refusal in CI, which is the record"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1000000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "The window counts from the day the check runs, so world-refuses must be shown by 2026-11-18",
    "Exact string comparison of module paths: a folder and a file inside it count separately, and a renamed module restarts its count"
  ]
}
```

## What this is

Finding 8 of `plan/research/design-books-cleanup.md`. Step back caps rounds inside one item; nothing caps fixes
across items. On 11-04 and 11-05 seven fix items changed `packages/engine/src/actors.js` one after another, and only the
run-lifecycle-store cleanup on 11-07 looked at its shape. The fix budget makes that look happen after the third fix,
and puts the rule in the plan check so CI enforces it rather than a builder's memory. The choices are in
`plan/decisions/2026-11-08-fix-budget-rule.md`.

The kind moved from decision to build: the decision is Claude's as stand-in (the decision file), and the work is a
change to `plan/check.mjs`. The replan that readied it also added `module` and `done_on` to the schema and
backfilled them on the done fix items and run-lifecycle-store, since done heads change only in a replan.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Without reading the builder's tests, write your
own under `verify/fix-budget-rule/`:

- **rule-written:** read `plan/README.md`, `CLAUDE.md` and `docs/language.md`.
- **names-module** and **budget-refuses:** copy the head's `plan/` to a temp folder, edit or add item heads there,
  run `node <temp>/check.mjs` and check exit code and output. Compute dates from today, not fixed strings.
- **backfill-true:** for every done `fix-` item, compare `done_on` with
  `TZ=UTC git log --date=format-local:%F --format=%cd -S'"status": "done"' -- plan/items/<id>.md | tail -1` in a full clone (not shallow), and `module` with its outputs.
- **world-refuses:** from the head, push a throwaway branch adding a ready `fix-` item naming
  `packages/engine/src/host.js`, open a PR (title starting "throwaway:"), read its ci run's plan check step, then
  close it unmerged. Do it by 2026-11-18.
- **tests-bite:** break the window or the reset in `plan/check.mjs`, run `node --test test/plan-check.test.mjs`,
  show it red, restore.
- **current-as-main:** `node plan/check.mjs` at the head; the tests reading changed files; read the diff; CI's full
  suite.
- **ci:** read the ci and gates checks at the head sha.

```json
{
  "id": "fix-event-close-tag",
  "title": "Keep a GitHub event whose field holds a closing event tag",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "module": "packages/engine/src/wake.js",
  "outcome": "A wake whose GitHub event carries the literal text </event> or </wake> inside a JSON string (a check title, a PR title, a comment) yields that event from wakesIn with its data parsed, so inputsOfWake offers it like any other; an event whose body is cut or is not a JSON object is offered as an unreadable event, which the host journals as a refused engine.transition row instead of dropping it without a row.",
  "why": "The engine-host suite pinned this as an observed defect: wakesIn ends an event at the first </event>, so anyone who can name a check or a PR can hide an event from the host (plan/decisions/2026-10-30-engine-effects.md, engine-host's open gaps). verify-regression-engine left that test rather than move a bug into the regression set, and its verifier noted the defect had no item of its own (verify/verify-regression-engine/verdict.json, observation 1). A </wake> in a field cuts the wake the same way, so the fix takes both close tags.",
  "serves": [
    "L-checks-against-world",
    "L-facts-from-source"
  ],
  "depends_on": [
    "verify-regression-engine"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-08-fix-event-close-tag.md",
      "what": "Read first: where an event and a wake end, what an unreadable event is and how its row reads"
    },
    {
      "ref": "packages/engine/src/wake.js",
      "what": "wakesIn's wake and event regexes, and inputsOfWake, which skips an event whose data is not an object"
    },
    {
      "ref": "packages/engine/src/host.js",
      "what": "refusal(), where an event from outside is checked against the workflow's meta.events before the machine sees it"
    },
    {
      "ref": "packages/engine/test/fixtures/wakes/, test/regression/fixtures/red-ci/delivered-wake.txt",
      "what": "Real wakes as the platform delivered them: each close tag starts its own line"
    }
  ],
  "outputs": [
    {
      "ref": "docs/language.md",
      "what": "An engine line for unreadable event, added before the code that uses the word"
    },
    {
      "ref": "packages/engine/src/wake.js",
      "what": "An event opens and closes only at a tag that starts a line (after spaces or tabs), and a wake closes only at a line-leading </wake> or right after its opening tag; an event with no close tag ends at the next event or the wake's end; inputsOfWake offers an event whose body is not a JSON object as { type: 'github.<kind>', unreadable: <its text> }, with the same source a readable event would have"
    },
    {
      "ref": "packages/engine/src/host.js",
      "what": "refusal() refuses an event carrying unreadable, with a reason that names it unreadable, before any schema or state check"
    },
    {
      "ref": "docs/journal.md",
      "what": "Engine rows say an unreadable event is journalled as a refused engine.transition row and what its reason reads"
    },
    {
      "ref": "test/plan-check.test.mjs, verify/verification-contract/lib.mjs, verify/verification-contract/tests-bite.test.mjs, verify/fix-budget-rule/lib.mjs",
      "what": "Each copy of plan/ these make gets an empty file at every module a ready or doing item names, so a ready fix item does not fail the untouched plan's check; no assertion changes (decision 4)"
    },
    {
      "ref": "packages/engine/test/wake.test.js",
      "what": "The builder's tests: a field holding </event> or </wake> keeps its event; forged markup in a field adds no input; a cut or non-object body gives one refused row whose reason names it unreadable, and a redelivery is a duplicate"
    }
  ],
  "expect": [
    {
      "id": "close-tag-kept",
      "check": "Through bin/host.js wake on a quick-fix item, a UserPromptSubmit wake whose check_run.completed event has a title holding </event>, and one whose title holds </wake>, each journals an engine.transition row for github.check_run.completed whose event carries that title and the other fields of the event's JSON",
      "how": "The verifier's own test, driving bin/host.js wake with a hook input on stdin and reading the item's journal file",
      "proof": "verifier"
    },
    {
      "id": "forged-markup-adds-nothing",
      "check": "A GitHub event whose fields hold a whole <event>...</event>, a </wake> followed by a new <wake>, a system-note or a task-notification yields exactly one input from inputsOfWake: the event that carried it, with that markup as text in its fields",
      "how": "The verifier's own test calling inputsOfWake",
      "proof": "verifier"
    },
    {
      "id": "unreadable-journalled",
      "check": "Through bin/host.js wake, an event whose JSON is cut off (no close tag before the wake's end), one whose body does not parse, and one whose body is a JSON array each journal one engine.transition row with outcome refused whose reason says unreadable, in the item's file, and the item's state after is its state before; the same wake offered again journals a duplicate row",
      "how": "The verifier's own test, driving bin/host.js wake and reading the item's journal file",
      "proof": "verifier"
    },
    {
      "id": "real-wakes-read",
      "check": "Each wake under packages/engine/test/fixtures/wakes/ and test/regression/fixtures/red-ci/delivered-wake.txt yields from wakesIn one wake whose GitHub events are the ones written in it, each with its JSON parsed; a scheduled wake written on one line (<wake ...></wake>) still fires a due timer",
      "how": "The verifier's own test calling wakesIn and inputsOfWake on the fixtures",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "unreadable event"
    ],
    "budget": 1
  },
  "non_goals": [
    "No change to which notifications bin/host.js wake reads (wakeTextOf) or to how a tap, a task notification or a timer is read",
    "No new journal kind and no new transition outcome: an unreadable event is a refused engine.transition row",
    "No change to any workflow"
  ],
  "records": [
    "the refused engine.transition row for an unreadable event, with the event's kind and text"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 300000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A wake whose close tag is not at the start of a line stops being read; every real wake and fixture puts it there, and the one-line scheduled wake bin/host.js builds is kept by the empty-body form",
    "A GitHub event JSON with a top-level key named unreadable would be refused; the platform's event keys are its own and none uses it"
  ],
  "done_on": "2026-11-08",
  "reader_effort": {
    "pr": 213,
    "files": 22,
    "exports_added": 0,
    "exports_removed": 0,
    "reader_lines": 744,
    "added": {
      "code": 21,
      "tests": 102,
      "verifier": 215,
      "evidence": 95,
      "docs": 5
    },
    "removed": {
      "code": 6,
      "tests": 1,
      "verifier": 5,
      "evidence": 0,
      "docs": 2
    }
  }
}
```

## What this is

Draft from the verifier's observations on `verify-regression-engine` (PR #199). `wakesIn`
(`packages/engine/src/wake.js`) ends an event at its first `</event>` and a wake at its first `</wake>`, so a field
holding either cuts the event: its JSON no longer parses or its close tag is gone, and `inputsOfWake` drops it without
a row. The platform writes an event's JSON on its own line and every close tag at the start of a line, and JSON
escapes a newline inside a string, so no field can put a close tag at the start of a line. The fix ends an event and a
wake only there, and an event that still can't be read is offered as an unreadable event the host refuses on the
record. The decision is plan/decisions/2026-11-08-fix-event-close-tag.md. The engine-host test that pinned the defect
(`verify/engine-host/forge.test.mjs` at 3862da5) left with verify-regression-engine; the builder's test asserts the
opposite.

## Done

Readied in #211 (contract at draft) and built in PR #213 (merged c26dca4), which set the status to ready beside the
fix to the four test helpers that copy `plan/` alone (decision 4; `verify/plan-reader-effort/plan-rule.test.mjs` got
the same fix after main brought it in). A separate session verified it at c2e8cba: all five Expect lines MET, each
verifier line naming its test under `verify/fix-event-close-tag/`. Engine code changed, so it was released as
harness-v0.1.41 (branch `release/harness-v0.1.41`). The head's `reader_effort` is
`node scripts/reader-effort.mjs 213 --json`.

The verifier's observations: a GitHub event's transition row carries the wake's current-time, so reading a journal
by position after a wake misses it (compare by row id); `bin/host.js wake` finishes open effects before offering the
wake's inputs, so a wake whose only event is refused can still add effect rows; and the system-note and
task-notification forgeries were already harmless before this fix, the close tags were the live hole. None needs an
item: the first two describe how the host already works, and the third confirms the scope.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under
`verify/fix-event-close-tag/` without reading the builder's. `test/regression/engine/forged-wakes.test.mjs` shows how
to restore a quick-fix item and call `inputsOfWake`, and how to drive `bin/host.js wake` with a hook input on stdin;
`test/regression/lib.mjs` has a check-run wake. Build each wake as the platform writes it: `<wake ...>` at column zero,
the `<event ...>` line indented, the JSON on its own line, `</event>` and `</wake>` each starting a line. For
close-tag-kept and unreadable-journalled, read the item's journal file before and after. Read the ci check at the
head sha. This container signs commits: commit any evidence holding commit shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Commit `verify/fix-event-close-tag/verdict.json`
with a verdict per Expect id.

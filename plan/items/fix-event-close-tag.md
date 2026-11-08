```json
{
  "id": "fix-event-close-tag",
  "title": "Keep a GitHub event whose field holds a closing event tag",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A wake whose GitHub event carries the literal text </event> inside a JSON string (a check title, a PR title, a comment) yields that event from wakesIn with its data parsed, so inputsOfWake records it like any other; an event whose body is cut or does not parse is journalled as unreadable instead of dropped without a row.",
  "why": "The engine-host suite pinned this as an observed defect: wakesIn ends an event at the first </event>, so anyone who can name a check or a PR can hide an event from the host (plan/decisions/2026-10-30-engine-effects.md, engine-host's open gaps). verify-regression-engine left that test rather than move a bug into the regression set, and its verifier noted the defect had no item of its own (verify/verify-regression-engine/verdict.json, observation 1).",
  "serves": [
    "L-checks-against-world",
    "L-facts-from-source"
  ],
  "depends_on": [
    "verify-regression-engine"
  ]
}
```

Draft from the verifier's observations on `verify-regression-engine` (PR #199). The parser is the event regex in
`wakesIn` (`packages/engine/src/wake.js`), which takes the shortest match up to `</event>`. The platform writes an
event's body as JSON on its own lines and closes it with `</event>` at the start of a line, so one likely shape is to end
an event only at a line-leading `</event>`, as `wakesIn` already does for `<wake>`; another is to read the JSON value
first and take the close tag after it. Decide in the replan which one holds for the real envelopes in
`test/regression/fixtures/` and the wake fixtures, and what the journal row for an unreadable event is called (add the
word to `docs/language.md` first). The test that pinned the defect is in `verify/engine-host/forge.test.mjs` at
3862da5; the fix's test asserts the opposite. A small, two-round item.

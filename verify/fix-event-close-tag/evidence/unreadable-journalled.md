# unreadable-journalled

At c2e8cba91c52147f95a18530e74103fec26f815b: `node --test verify/fix-event-close-tag/unreadable.test.mjs` -> 3/3 pass.

Same item and host.js wake as close-tag-kept. Three wakes: a check_run.completed whose JSON is cut to its first 40
characters with no `</event>` before `</wake>`; a body `{"check":"test", conclusion: failure`; a body that is a
JSON array of the event. For each, reading the journal file before and after: exactly one new engine.transition row,
source github, outcome refused, reason matching /unreadable/ (the host writes "github.check_run.completed is an
unreadable event: its body is cut or is not a JSON object"), event type github.check_run.completed; its state equals
the last row's state before the wake, and host.js reports the same state. No other transition row is added (the host
does finish its open approval card effect first, so effect rows appear). Offering the same wake again adds one
engine.transition row with outcome duplicate and leaves the state.

Control: with main's wake.js/host.js, 0/3 pass (no row at all: the event vanished).

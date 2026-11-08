# Where a wake's event ends, and what happens to one that can't be read (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of `fix-event-close-tag`
(drafted by the done replan of verify-regression-engine; the person's go to continue autonomously, 8 Nov 09:27Z).

## 1. A close tag counts only at the start of a line

The draft offered two shapes: end an event only at a `</event>` that starts a line, or read the JSON value first and
take the close tag after it. Every real wake (`packages/engine/test/fixtures/wakes/`,
`test/regression/fixtures/red-ci/delivered-wake.txt`) and every wake the tests build writes `<event ...>` indented on
its own line, the JSON on the next, and `</event>` and `</wake>` each starting a line. JSON escapes a newline inside a
string, so no field's text can start a line. The line anchor is the smaller change, it is the rule `wakesIn` already
keeps for `<wake>`, and it does not need a JSON scanner. Reading the JSON first would also survive a platform that
put the close tag on the JSON's line, which no wake has done; if one does, that is a new item.

The same holds for `</wake>`: a field holding it cut the wake, and the event inside lost its close tag, so it vanished
the same way. A wake closes at a line-leading `</wake>`, or right after its opening tag for the empty wake
`bin/host.js` builds for a fired reminder (`<wake ...></wake>` on one line). An `<event>` opens only at the start of a
line too, after spaces or tabs, so markup inside a field is never an event of its own.

## 2. An event that still can't be read is an unreadable event, refused on the record

With the anchor, an event whose JSON is cut (no close tag before the next event or the wake's end) or does not parse
still can't give the workflow its fields. Dropping it without a row hides it, which is the defect. `inputsOfWake`
offers it as `{ type: 'github.<kind>', unreadable: <its text> }` with the source a readable event would have (kind and
a hash of its text), and the host's `refusal()` turns it away before the schema and state checks, so `offer()` writes
the `engine.transition` row the journal already has for an event turned away: outcome `refused`, reason naming it
unreadable. A body that parses to something other than an object (an array, a string) is unreadable too.

No new kind and no new outcome: `refused` already means "the item doesn't take this", the reason says why, and every
reader of transition rows already knows it. The new word is "unreadable event" in `docs/language.md`, Engine. An event
with no `kind` still offers nothing, since it has no type to journal under.

## 3. Scope and release

The fix lands in `packages/engine/src/wake.js` (the item's `module`), with one check in `host.js`. It touches no file
the parallel items own (scripts/gates, plan/check.mjs, marks.js, spec.js, the setup and capture tests). It changes
engine code the plugin ships, so the build is released after it merges.

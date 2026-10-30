```json
{
  "id": "journal-schema",
  "title": "Define the one journal format every record uses, versioned from the first row",
  "stage": "s0-environment",
  "kind": "build",
  "status": "ready",
  "outcome": "A JSON Schema and a tiny append library define the journal: append-only JSONL, one writer per file, every row versioned and attributed, with upcasting on read.",
  "why": "v1's store had no schema version, so every format or rule change broke replay, and joining histories took about 15 PRs. Observability, the engine and the pages all read this format, so it comes first and is versioned from row one.",
  "serves": ["L-version-event-schema", "L-library-mount-slow", "L-record-route-at-write", "L-placeholders-labelled", "L-older-writer-refused", "L-one-history", "L-effects-acked-once"],
  "depends_on": ["repo-skeleton"],
  "inputs": [
    { "ref": "plan/ledger/data.md", "what": "What v1's store got wrong" },
    { "ref": "v1 packages/harness/spec/history.schema.json", "what": "v1's history row format, the closest prior art" }
  ],
  "outputs": [
    { "ref": "packages/journal/schema/row.schema.json", "what": "Row envelope: v, id, at, kind, source {system, ref}, session, agent, item, state, release, payload" },
    { "ref": "packages/journal/src/", "what": "append(row) to <root>/<session>.jsonl (one writer per file), read(root) merging files by time, upcast(row) per version, refuse writes from an older release" },
    { "ref": "docs/journal.md", "what": "The kinds vocabulary (session.fingerprint, tool.call, agent.spawn, agent.finish, turn.usage, refusal, hook.run, person.message, person.tap, card.posted, brief.stored, result.stored, ci.result, page.refresh) and how to add a kind" }
  ],
  "expect": [
    { "id": "schema-tests", "check": "Rows of every kind validate; a row missing source or v fails", "how": "npm test -w packages/journal" },
    { "id": "one-writer", "check": "Two sessions appending at once never interleave within a file, and read() returns both in time order", "how": "A test with two writers on a temp folder" },
    { "id": "upcast", "check": "A v1-shaped row is upcast on read and the file on disk is unchanged", "how": "A test hashes the file before and after read" },
    { "id": "older-writer", "check": "A writer whose release is older than the newest row's release is refused, naming both versions", "how": "Test for case C-older-writer-refused" },
    { "id": "no-scan-on-append", "check": "append() opens exactly one file and lists no folder", "how": "A test counts fs calls with a stub" }
  ],
  "cases": ["C-older-writer-refused"],
  "concepts": { "adds": ["journal row", "row kind", "upcaster"], "budget": 3 },
  "non_goals": ["No engine events yet (engine rows get kinds in stage 3)", "No v1 history import (parity stage, optional)", "No database"],
  "records": ["Defines the record names every other item uses"],
  "person_prereqs": [],
  "step_back": { "max_rounds": 2, "max_tokens": 2000000 },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": ["Where the journal lives in a fresh project (the Library folder chosen at install) is decided in plugin-install"]
}
```

## Notes

Only external inputs and observations are journalled: tool calls, completions, wakes, taps, CI results. Nothing an
agent says about itself becomes a row (ledger L-agents-self-report). The engine's own transitions arrive in stage 3
as rows of kind `engine.transition` with the transition id recorded at write time (ledger L-record-route-at-write).

## Verifier brief

Run the package tests. Write your own two-writer stress test (100 rows each, at once) on a temp folder and confirm
no torn line. Hand-write an old-version row and confirm read() upcasts it without touching the file. Verdict per
Expect id.

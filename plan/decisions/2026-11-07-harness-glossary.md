# Harness glossary: which words change and how old journals read (2026-11-07)

Claude's two-way-door decisions as stand-in for the person, writing the ready contract of `harness-glossary`
(research `plan/research/design-books-cleanup.md`, finding 1; the person's go for all eight cleanup items, 7 Nov).

## Which words change

- **brief** keeps the brief stage and the per-role briefs it returns (`brief.stored`, written only by accept for that
  stage). A run's rendered prompt becomes `prompt.md`, `promptHash` and `prompt.stored`. The research named these.
- **Capture rows** get `agent.prompt` and `agent.final`. Picked over `capture.prompt` because the row is about the
  agent (its `agent` field is the subagent), and the kind should say what it records, not which hook wrote it.
- **actor, actors.mjs, stage** are documented in `docs/language.md`, not renamed. Renaming them touches every workflow
  file and the plugin's hook names for little gain until the glossary has been used; the research defers *step*.

## How old journals read

- **Journal v2 with an upcaster**, not readers that sniff payload shapes. The upcaster tells the three v1 uses of
  `brief.stored` apart once, in one place (prompt row: has `contextHash`; capture row: no `run`; brief stage row:
  has `role` and no `contextHash`), which is what `L-version-event-schema` asks for. The cost is the first bump:
  an offline reader on an older release marks v2 rows as newer, and says so.
- **Run folders are not rewritten.** `names.js` `promptFile` falls back to `brief.md` when a folder has no
  `prompt.md`, so committed bench runs, verify evidence and in-flight runs prepared by an older release still read
  and spawn. That is the one place the old file name stays.

## Considered

- Adding the new kinds without a bump: readers would have to sniff `agentId` versus `run` to read old journals, the
  translator bottleneck this item removes.
- Rewriting committed journals: forbidden by append-only and upcast-on-read.

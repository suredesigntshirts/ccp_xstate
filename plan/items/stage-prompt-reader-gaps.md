```json
{
  "id": "stage-prompt-reader-gaps",
  "title": "Close the gaps a fresh reader finds in the model stages' prompts",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A fresh headless session given only a rendered stage prompt (workflows/<workflow>/<stage>.md with its inputs) for each quick-fix stage names no point where it had to guess what to do, return or refuse; every gap it named is answered in the stage file or packages/engine/messages.md, and the stage bench shows no stage scoring worse than before.",
  "why": "Refine rounds 6, 7, 9 and 10 found each unclear rule by giving a fresh session only the repo and asking where it guessed, but only for the texts builders and verifiers read; the words the harness hands its own model stages, which decide whether a run's agent does the right thing, never had that test (person's goal, 8 Nov: models know exactly what to do and do it well each time).",
  "serves": [
    "L-rules-live-in-the-repo"
  ],
  "depends_on": [
    "run-message-and-budget",
    "retire-brief-file-fallback"
  ]
}
```

Draft written at the end of the refine rounds (8 Nov). The method that worked in rounds 6 to 10: in a clean clone,
`env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p` with an empty `HOME`, a role and a situation, and "list every point
where you had to guess, where two texts disagree, or where a term was used before it was defined", then answer each
gap where that reader would look (`plan/decisions/2026-11-08-refine-round-10.md` shows the shape).

Here the reader gets what a stage agent gets: the rendered prompt for `brief`, `build` and `verify` in
`workflows/quick-fix/` (the Inspector and `prompt.md` show it), then the same for `intake` and `research` if the first
pass finds gaps. Changes to stage files are behaviour: bench each changed stage before and after
(`docs/prompts.md`, `bench/`).

Waits for `run-message-and-budget` and `retire-brief-file-fallback`, which change what a run's prompt holds and where
it lives; reading the prompts before they land would answer gaps that are about to move.

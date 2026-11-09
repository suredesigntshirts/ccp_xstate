# Verifying an item

How a plan verifier writes and runs its tests: the techniques the rules in `docs/gates.md` and `docs/layout.md`
leave open. Container traps that any thread meets are in `docs/traps.md`. This is a notes file: any PR may add or
correct an entry with no `Item:` line (`docs/gates.md`), so a verifier writes a technique here in the PR where it
learnt it, never only in project memory.

## A reader without memory

Start a reader that must answer from the repo alone with `node scripts/fresh-reader.mjs --cwd <clean clone> "<prompt>"`.

## The verdict file

Start `verify/<item>/verdict.json` with `node scripts/gates/new-verdict.mjs <item>`, then fill each result.

# Verifying an item

How a plan verifier writes and runs its tests: the techniques the rules in `docs/gates.md` and `docs/layout.md`
leave open. Container traps that any thread meets are in `docs/traps.md`. This is a notes file: any PR may add or
correct an entry with no `Item:` line (`docs/gates.md`), so a verifier writes a technique here in the PR where it
learnt it, never only in project memory.

## A reader without memory

Start a reader that must answer from the repo alone with `node scripts/fresh-reader.mjs --cwd <clean clone> "<prompt>"`.
It runs on the session's OAuth sign-in and turns auto memory off; `--bare` would need an API key
(`plan/ledger/platform.md`, L-headless-auth-and-memory).

## The verdict file

Start `verify/<item>/verdict.json` with `node scripts/gates/new-verdict.mjs <item>`, then fill each result.

## Command shapes that drop work

`node --test-reporter=tap a b c` without `--test` runs only `a`, as a script; with `--test` it runs all three.
`claude -p --allowedTools "a,b" "<prompt>"` takes the prompt as one more tool name, since the flag is variadic: give
the prompt on stdin, and `< /dev/null` when there is none. `scripts/fresh-reader.mjs` already does.

## Transcripts in evidence

Commit an extract of a transcript, never the raw file: the rows a check reads, cut to the fields it needs. A raw
transcript holds the account's email and attachment rows (`credential_org`, `prompt_snapshot`) that must not enter
the repo.

## The base side, without history

`ci` checks out at depth 1, so a test cannot read the PR's base from git (`docs/traps.md`, "Clones can be
shallow"). To show what the base did, record its answers with a script into the evidence, or commit the change as
`to-base.diff` and apply it in a clone made in the test. A temp repo that a gate runs in is built by copying `plan/`
and `scripts/`, not by cloning.

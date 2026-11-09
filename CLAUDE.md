# ccp_xstate

The v2 harness, rebuilt on XState. This file is a map, not the manual: standing knowledge lives in `docs/` and
`plan/`, where it can be checked. `test/docs.test.mjs` keeps this file short and every path it names real.

## Principles

- **The verifier proves it, not the builder.** An item is done when a separate session's verdict shows its outcome
  holds (`plan/README.md`, "How slop is kept out").
- **The why travels with the work.** Every change names its plan item; the item's prose holds the reasoning.
- **Comments say what holds now.** Item ids, lanes and rounds go in commits, PRs and the plan, never in code
  comments or READMEs (`docs/layout.md`, "Comments").
- **A cleanup changes structure, not behaviour.** Behaviour is what the glossary names and the regression set asserts.
  A test that asserts bytes, a listing or a retired path leaves with the code it pinned, named by the item.
- **A working small system first** (Gall's Law), end to end before wide, root cause over symptom.
- **One word per thing.** Use the terms in `docs/language.md`; add a line there before introducing a new one.
- **Step back, don't grind.** An item's `step_back` caps its rounds; past that, replan. A fourth fix to one module in
  14 days becomes a design item (`plan/README.md`, "Fix budget").
- **Decide two-way doors and write them down** in `plan/decisions/`. One-way doors (settings, secrets,
  anything outside this repo and the scratch repo) go in `plan/decisions/waiting-for-person.md`.

## Working an item

One plan item per PR. `plan/README.md`, "How an item moves", gives the four steps to done, with each PR's
branch, label and `Item:` line; `docs/gates.md` gives what the gates check. Branches carry no `claude/` prefix.

## Layout

The one map of the repo; `docs/layout.md` holds the rules for tests, comments and dependencies.

| Path | What |
|---|---|
| `plan/` | The plan: items, stages, ledger, cases, decisions. Start at `plan/README.md` |
| `packages/` | npm workspaces for the harness libraries: `packages/journal/` is the record format, `packages/engine/` loads and hosts workflows and runs their effects, `packages/engine/messages.md` is every text the harness hands a model |
| `workflows/` | Workflow files as XState JSON, each model stage's words in `workflows/<workflow>/<stage>.md`; `workflows/quick-fix.json` is the first |
| `plugins/` | npm workspaces for the Claude Code plugins; `plugins/harness/` is the one threads install |
| `verify/<item>/` | The verifier's tests, evidence and `verdict.json` for each item |
| `test/` | Repo-wide tests, such as the workspace rules and `test/docs.test.mjs` |
| `scripts/` | `scripts/gates/` the PR gates; `scripts/ci/` picks the guards a PR runs; `scripts/release/` cuts a plugin release; `scripts/inspector/` the Workflow Inspector (`docs/inspector.md`); `scripts/bench/` the stage bench (`docs/prompts.md`); `scripts/tournament/` the design-tournament kit (`docs/tournaments.md`); `scripts/clean-room/` checks a fresh install in an empty HOME; `scripts/debug/` debugging aids such as `scripts/debug/trace-writes.mjs` |
| `bench/` | One folder per benched model stage: rubric, cases, run sets and reports |
| `tournaments/` | One folder per design tournament, indexed in `tournaments/README.md`; lane code stays in the scratch repo |
| `probes/` | Throwaway platform probes; `probes/platform/` fed `plan/research/platform-baseline.md` |
| `infra/` | `infra/cloud-environment/` holds the cloud environment's setup script |
| `vendor/` | Third-party tools copied in verbatim; `vendor/documentation-downloader/` is the docs skill setup installs |
| `.github/` | `.github/workflows/ci.yml` and `.github/workflows/verdict.yml` run on every PR |
| `docs/` | Standing knowledge, one file per subject; `docs/language.md` is the glossary, `docs/traps.md` the container traps |

## Commands

```
npm test                 # the guards: node:test over test/, scripts/, packages/ and plugins/
node plan/check.mjs      # the plan check; CI runs both on every PR
node --test "verify/<item>/*.test.mjs"   # one suite: name its files, a bare folder fails
```

Node 22 or later. A runtime dependency needs a `plan/decisions/` file naming it (`docs/layout.md`, Dependencies).

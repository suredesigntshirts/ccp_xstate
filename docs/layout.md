# Repo rules

The map of the repo is `CLAUDE.md`'s Layout table. This file holds the rules a table can't: tests, comments and
dependencies.

## Tests

Tests use `node:test` and `node:assert`, nothing else. Name them `*.test.js` or `*.test.mjs`. `npm test` runs
every test under `test/`, `scripts/`, `packages/`, `plugins/` and `verify/`, so a workspace needs no test script
of its own to be covered by CI.

A test that reads a rule text (`CLAUDE.md`, `plan/`, `docs/`) matches each word or term that carries the rule on its
own (for "the first commit sets the status to `done`": `first commit`, `status`, `done`), never a phrase or a whole
sentence, so a rewording that keeps the rule keeps the test green.

## Comments

Comments and READMEs are present tense: they say what holds and why it must hold, such as a platform fact or a race
the code guards against. Where a line came from (its plan item, a design's section, a tournament lane, round or graft)
goes in the commit, the PR and the plan, where `git log` and the item id find it. The `stubs` gate refuses a history
reference in the harness source (`packages/engine/src` and `bin`, `packages/journal/src` and `bin`,
`plugins/harness/scripts`, `scripts/inspector`, `scripts/bench`) and the engine and plugin READMEs; tests and
vendored code are exempt. The pattern is `HISTORY` in `scripts/gates/lib.mjs`.

## Dependencies

A runtime dependency is allowed when a file in `plan/decisions/` names it, on a line of its own:
``Runtime dependency: `<name>` `` (plan item prompt-catalogue, `plan/decisions/2026-11-06-prompt-catalogue.md`).
Each one runs inside every thread's hooks, so it is chosen on purpose, not by drift. Named so far: `xstate` and
`mustache` (`plan/decisions/2026-11-06-prompt-catalogue-build.md`). Sibling workspaces need no record.
`test/workspaces.test.mjs` fails a `package.json` whose runtime dependency no decision names. Dev tooling stays at
what Node ships. Each dependency is pinned to an exact version in its `package.json` and in `package-lock.json`; CI
installs it with `npm ci`.

The installed plugin has no `node_modules`, so engine code the hooks load imports a dependency from a verbatim copy
beside it: `packages/engine/src/vendor/mustache.mjs` is the `mustache` package's `mustache.mjs`, and
`packages/engine/test/messages.test.js` fails when the copy and the installed package differ.

`vendor/` is outside that rule: it holds tools sessions use (such as the documentation-downloader skill), not
harness code, and it is neither a workspace nor covered by `npm test`. Its packages install their own dependencies
where they are installed (`infra/cloud-environment/setup.sh`).

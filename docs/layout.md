# Repo layout

```
package.json        npm workspaces (packages/*, plugins/*); Node 22+; `npm test` runs everything
packages/<name>/    a harness library: package.json, src/, test/
plugins/<name>/     a Claude Code plugin: package.json, .claude-plugin/plugin.json, and its parts
workflows/          workflow files: XState machine config as JSON, loaded by packages/engine, each model stage's
                    words in workflows/<workflow>/<stage>.md; intake.json shapes and challenges a request into
                    an issue, then starts quick-fix.json as a child item
verify/<item>/      the verifier's own tests for an item, and its verdict.json
scripts/gates/      the PR gates verdict.yml runs, with their tests
scripts/tournament/ the generic design-tournament kit: runner, args builder, measure, CI template (docs/tournaments.md)
scripts/inspector/  the Workflow Inspector: exporter, build and page that show any run step by step (docs/inspector.md)
scripts/bench/      the stage bench: run one model stage alone, score it per rubric criterion, compare versions (docs/prompts.md)
bench/<stage>/      one stage's bench: rubric, cases (with seed repos), judge check, run sets and reports
tournaments/<id>/   one design tournament: pack, config, measure, result, scores; indexed in tournaments/README.md
test/               repo-wide tests
vendor/<name>/      third-party code copied in verbatim, not a workspace; vendor/README.md names each source and sha
plan/               the plan (plan/README.md)
docs/               standing knowledge, one file per subject
```

## Tests

Tests use `node:test` and `node:assert`, nothing else. Name them `*.test.js` or `*.test.mjs`. `npm test` runs
every test under `test/`, `scripts/`, `packages/`, `plugins/` and `verify/`, so a workspace needs no test script
of its own to be covered by CI.

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

# Repo layout

```
package.json        npm workspaces (packages/*, plugins/*); Node 22+; `npm test` runs everything
packages/<name>/    a harness library: package.json, src/, test/
plugins/<name>/     a Claude Code plugin: package.json, .claude-plugin/plugin.json, and its parts
workflows/          workflow files: XState machine config as JSON, loaded by packages/engine
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

No runtime dependency except `xstate` and sibling workspaces. `test/workspaces.test.mjs` fails a
`package.json` that adds one. Dev tooling stays at what Node ships. `xstate` is pinned to an exact version in each `package.json` and in
`package-lock.json`; CI installs it with `npm ci`.

`vendor/` is outside that rule: it holds tools sessions use (such as the documentation-downloader skill), not
harness code, and it is neither a workspace nor covered by `npm test`. Its packages install their own dependencies
where they are installed (`infra/cloud-environment/setup.sh`).

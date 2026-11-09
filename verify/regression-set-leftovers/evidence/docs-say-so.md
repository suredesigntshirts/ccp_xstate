# docs-say-so

Command: node --test verify/regression-set-leftovers/docs-say-so.test.mjs

Excerpt: 4 pass at fa9c1957. CLAUDE.md: "npm test # the guards: node:test over test/, scripts/, packages/ and
plugins/". ci.yml step: "npm test (test, scripts, packages, plugins)". docs/gates.md ci row: "...; `verify/` is not run
here, the verdict gate runs a PR's own verifier tests". docs/layout.md Tests: "It never runs `verify/`: a verifier's
suite proves its own PR, and the verdict gate runs it there. A proof of behaviour other code relies on is written again
as a guard under `test/regression/`."

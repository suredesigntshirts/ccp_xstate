# still-bite

Command: `node --test verify/faster-nested-test-runs/still-bite.test.mjs` at ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f (11 pass, 2m52s on a 4-core container).

Inputs: each case works in a temp copy of the head's plan/, scripts/, test/, packages/, plugins/, workflows/, infra/, docs/, package.json and CLAUDE.md with node_modules linked (`fntr-bite-*`), or for self-edit-check a lean clone of the head with the break committed (`fntr-sec-*`). No environment set beyond the container's.

Excerpt:
- The seven narrowed mutation checks (build-sets-done, contract-and-verdict-tests, evidence-links-listings, verdict-cutoff, lean-ready-head, no-doing-status, ready-rules-named) each pass intact; each fails when every test it names in plan-check.test.mjs or pr-gate.test.mjs is hollowed to pass whatever the code does (the broken rule no longer turns anything red); each fails when the first named test is renamed, so its pattern matches nothing ("intact pass 1; hollowed fail 1; renamed fail 1" for all seven).
- self-edit-check, whose env-inherited, runs-without-strace and temp-removed now read one no-self-edit run: temp-removed goes red when no-self-edit leaves a temp folder; runs-without-strace goes red when no-self-edit throws without strace on PATH; env-inherited goes red when no-self-edit passes the thread's CLAUDE*/CCP* variables on. temp-removed for setup.test.mjs, which now reads tags-dropped's run, goes red when setup.test.mjs leaves a temp folder.

# shared-runs-all

Command: node --test verify/pr-test-selection/shared-runs-all.test.mjs

Excerpt: 4 pass at 5d758cf5. package.json, package-lock.json, .github/workflows/ci.yml and
scripts/ci/select-tests.mjs each select ALL, alone and beside a plan file. New untracked paths no guard names
(infra/new-thing.sh, a-new-top-level-file.txt, vendor/new-tool/x.js) select ALL. Each of the 101 tracked files at the
head that no guard reaches, outside plan/ docs/ bench/ tournaments/ verify/ probes/, selects ALL. A plan file plus
tournaments/README.md selects a list, not ALL.

In real ci: PR #282's test job 129085475380 at 5d758cf5 printed "changed: 7 file(s)" and "running every guard:
shared file changed: .github/workflows/ci.yml, scripts/ci/pr-tests.mjs, scripts/ci/select-tests.mjs".

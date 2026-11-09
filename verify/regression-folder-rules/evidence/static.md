# static

Command: `node --test verify/regression-folder-rules/static.test.mjs` at 58725ca4e18d35a7b6375b910092dc0d2e753714 (2 pass); five plain runs of `node --test test/regression-rules.test.mjs` on a 4-core container.

Excerpt: the guard imports only node:test, node:assert/strict, node:fs and node:path, with no dynamic import, child_process, fetch, temp folder or write; whole node --test runs took 141 to 159 ms (process start included), the test's own bar is under 2000 ms for the slowest of three.

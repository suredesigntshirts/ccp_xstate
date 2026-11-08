# scope

Command: `node --test verify/verify-regression-engine/scope.test.mjs` at ad3d018: `git diff -M --name-status 3862da5 ad3d018`.

Excerpt: 3/3 pass. Every path is under test/regression/, the 26 folders or the item file, except verify/harness-glossary/lib.mjs (M), whose base text with the 7 moved fixtures' old paths swapped for the new equals the head text. `git diff --name-only` over packages plugins workflows scripts bench is empty. The 7 fixture moves are R100. verify/harness-glossary's 17 tests pass at the head.

# link-refused

Command: `node --test verify/evidence-gate-edges/link-refused.test.mjs` at 10dad10eaa0cb475756403011bb41923694d092c (also in a depth-1 clone, no origin/main).

Inputs: each case is a temp git repo holding a copy of scripts/ and package.json at a base commit on main; a PR branch
adds the entry; the gate runs as `BASE_SHA=<base> node scripts/gates/pr-gate.mjs evidence`. Symlink targets:
`data/big.bin` (100 KB, outside verify/) and `data/small.txt` (3 bytes). The submodule is
`git update-index --add --cacheinfo 160000,<base sha>,verify/x/sub`.

Excerpt: 4 tests, 4 pass.

- symlink to 100 KB file: exit 1, "verify/x/evidence/a.md is a symlink; a file under verify/ must be a regular file, ..."
- symlink to small file: exit 1, the same line.
- submodule: exit 1, "verify/x/sub is a submodule; a file under verify/ must be a regular file, ..."
- regular 50-byte verify/x/evidence/a.md: exit 0, "evidence gate passed".

Against origin/main's gate the first three fail (the gate passes them), the fourth passes.

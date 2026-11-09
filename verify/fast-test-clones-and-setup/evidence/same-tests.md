# same-tests

Command: `node --test verify/fast-test-clones-and-setup/same-tests.test.mjs` at be40cff22a443e1d5be0f9dd0ac1cce00837e00b, and
`node verify/fast-test-clones-and-setup/record.mjs <base clone> <head clone> <out.json> 3` (base 4f221631407e919218e0726147a431dd94a9fd15, head be40cff22a443e1d5be0f9dd0ac1cce00837e00b).

Excerpt: the static test passes 2: the 7 changed test files keep the same test calls in the same order and add no
skip. record.mjs, TAP reporter, each file alone: no-self-edit 6, self-edit-check 27, setup 6, clean-room run 4,
release-clone-and-keep 3, setup-install 3, setup-release 7 results; at base and head the same names, every one ok,
0 skipped, 0 todo, in all three rounds for the timed files.

Inputs: two fresh clones of the repo at base and head, npm ci, release tags and release branches deleted, origin set
to the GitHub URL (as ci's checkout); a 4-core container with nothing else running.

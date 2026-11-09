# faster

Command: node --test verify/batched-gate-reads/faster.test.mjs (freeze and stubs timing), and for the guards' CPU, in
fresh clones of main 829fa83b09c94f6955bc6da982ba0e750cf64041 and the head 188c9b9620b4fa41fbe161cd921ed94bccf89fad
after npm ci, with `env -i PATH=$PATH HOME=<empty dir>`:
`time node --test "scripts/gates/test/*.test.mjs" "test/regression/gates/*.test.mjs"`, three rounds alternating
base and head, run one at a time on a 4-core container.

Excerpt, gates (median of 5 alternating runs in a temp repo of the checkout's plan/ and scripts/, plus packages/ and
plugins/ for stubs, with one new item as the PR):
- freeze: base 3040 ms, head 157 ms
- stubs: base 844 ms, head 124 ms

Excerpt, guards (175 tests, 175 pass at both; real / user / sys in s):
- base: 28.9 / 50.8 / 30.3, 31.7 / 52.2 / 37.5, 30.6 / 51.6 / 33.8 (user+sys 81, 90, 85 s)
- head: 17.7 / 30.7 / 14.8, 18.2 / 30.3 / 16.7, 17.7 / 29.7 / 15.8 (user+sys 45, 47, 45 s)

The head's guard files are the base's: the PR changes only scripts/gates/pr-gate.mjs and its item, so the CPU drop is
the same 175 tests doing less work, not fewer or weaker tests.

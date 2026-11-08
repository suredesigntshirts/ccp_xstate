# child-before-return

Command, from a checkout at 6472dc6bd76d43db4c6ace82f857f15403020abc: `node --test verify/fix-trace-writes-clone-cwd/child-before-return.test.mjs`.
The traces are built in the test (lib.mjs: parent 4100 chdirs to /vroot/p, logs `clone(... <unfinished ...>`,
child 4101 logs its calls, then `4100 <... clone resumed>) = 4101`); root /vroot, start folder /vstart. The base is
`git show 8244eae5c7b411b175f05af25f2144555e7abfb0:scripts/debug/trace-writes.mjs` written to a temp file and imported; in a depth-1 checkout the base is
fetched at depth 1 first, and only the base test skips if that fails.

Excerpt:

    ok - head: the child keeps its own chdir and inherits the parent folder when logged before the clone returns
    # with chdir: ["/vroot/p/sub/made"]; without: ["/vroot/p/m2"]
    ok - base: the same two traces report neither path
    # base with chdir: []; without: []

Also passed, 2/2 tests each, in a fresh `git clone --depth=1` of build/fix-trace-writes-clone-cwd (no origin/main).

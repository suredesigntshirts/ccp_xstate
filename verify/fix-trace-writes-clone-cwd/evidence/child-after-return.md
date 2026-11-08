# child-after-return

Command, from a checkout at 82c86117f65646132646540b8006bed66aa2b2a4: `node --test verify/fix-trace-writes-clone-cwd/child-after-return.test.mjs`.
Trace 1: `5200 chdir("/vroot/p")`, `5200 clone(...) = 5201`, `5200 chdir("/vroot/q")`, `5201 mkdir("m3")`,
`5200 mkdir("pm")`. Trace 2: start folder /vroot/s and pid 6300, which no clone returned, makes `mkdir("orphan")`.

Excerpt:

    ok - head: a child logged after the clone returns resolves against the parent folder at the clone
    # [{"pid":5201,"path":"/vroot/p/m3"},{"pid":5200,"path":"/vroot/q/pm"}]
    ok - head: a pid no logged clone returned resolves against the start folder
    # [{"pid":6300,"path":"/vroot/s/orphan"}]

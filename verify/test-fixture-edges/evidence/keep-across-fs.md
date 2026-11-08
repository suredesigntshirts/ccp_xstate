# keep-across-fs

Command: `node --test verify/test-fixture-edges/keep-across-fs.test.mjs`, at af64a367c242b66cf968aad168b40e5141d029a3.

Inputs: each run gets a fresh `TMPDIR`; the other file system is the first writable of /dev/shm, /run/shm, /run/user/<uid>,
/run, /var/tmp, the repo, whose st_dev differs from the temp dir's (here /dev/shm, dev 27 vs 65024). Command traced: `true`.
Real strace 6.x where present; a stand-in strace on PATH (writes an execve line to its -o file, then execs the command)
always, so CI (no strace) still runs the --keep path. Base: a clone with to-base.diff applied.

Excerpt:

```
ok 1 - real strace: --keep works on the same and on another file system
# real strace, same fs (/tmp/verify-tfe-probe-Ll2ECz/kept.trace): exit 0, 6823 bytes, left []
# real strace, other fs (/dev/shm/verify-tfe-other-MKyhCM/kept.trace): exit 0, 6823 bytes, left []
ok 2 - stand-in strace: --keep works on the same and on another file system
ok 3 - with the build change taken out, --keep to another file system fails with EXDEV
# exit 1; Error: EXDEV: cross-device link not permitted, rename '.../trace-writes-npNvB1/trace' -> '/dev/shm/verify-tfe-other-11FYlU/kept.trace'
```

Each kept trace matches `execve("…/true"`.

# still-true

Reproduced in a thread's container on 2026-11-09 (node v22.23.4, git 2.43.0). Temp folders under the scratchpad; the toy repo committed with GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false; the /mnt/project-files folder was removed after.

```
## reporter shape (node v22.23.4)
$ node --test-reporter=tap a.test.mjs b.test.mjs c.test.mjs
ok 1 - a runs
# tests 1
# pass 1
$ node --test --test-reporter=tap a.test.mjs b.test.mjs c.test.mjs
ok 1 - a runs
ok 2 - b runs
ok 3 - c runs
# tests 3
# pass 3

## git stash create leaves untracked files out
stash create (untracked): tracked.txt 
stash create (after git add): tracked.txt untracked.txt 

## hard link on /mnt/project-files
$ ln src.txt dst.txt (on /mnt/project-files)
ln: failed to create hard link '/mnt/project-files/verify-scratch-mlw/dst.txt' => '/mnt/project-files/verify-scratch-mlw/src.txt': Operation not supported
exit 1
$ ln (container disk, control)
exit 0
```

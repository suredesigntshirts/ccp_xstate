# world-refuses

Command: throwaway branch throwaway/evidence-gate-edges-world, commit 9ac12abfd5492e1ac58a9c30936ff155a130636a on
10dad10eaa0cb475756403011bb41923694d092c, adding verify/x/evidence/a.md as a symlink to ../../../package-lock.json and verify/x/evidence/listing.txt
(1,125 bytes, the piped `node --test` output of a temp file of 12 passing tests). PR
https://github.com/suredesigntshirts/ccp_xstate/pull/242 titled "throwaway: evidence gate refuses a symlink and a
listing.txt"; gates job 128721065827 read with get_job_logs; PR closed unmerged.

Excerpt (step "evidence under verify/ ..." of the gates job):

    evidence gate failed:
      verify/x/evidence/a.md is a symlink; a file under verify/ must be a regular file, so commit the command, the excerpt and the inputs instead
      verify/x/evidence/listing.txt is a test listing (node:test results and a pass and fail summary); commit the command, the excerpt and the inputs instead
    ##[error]Process completed with exit code 1.

The remote branch delete was refused by the session's git proxy; the branch is left for the person to delete.

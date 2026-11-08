# world-refuses

Command: throwaway PR https://github.com/suredesigntshirts/ccp_xstate/pull/198, branch
throwaway/verify-evidence-policy-world, commit eff1547d609e7d163f5a62621743b9a0377c58a4 on 7f52c6f6e724ab8af45cddf35cbde0847016f05e adding
verify/x/listing.pass (9 bytes) and verify/x/capture.json (71,680 bytes); verdict run 42468178514, gates job
128692462928 read with get_job_logs; PR closed unmerged. Branch left for the person to delete.

Excerpt, step "evidence under verify/ is small and is not a test listing":
evidence gate failed:
  verify/x/capture.json is 71680 bytes, over the 65536-byte limit for a file under verify/; commit the command, the excerpt and the inputs instead
  verify/x/listing.pass is a test listing (.pass); commit the command, the excerpt and the inputs instead
##[error]Process completed with exit code 1.
(The later verdict step ran too, since it is `!cancelled()`, and failed for naming no item.)

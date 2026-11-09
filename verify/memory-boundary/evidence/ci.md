# ci

Command: actions_list list_workflow_runs and list_workflow_jobs for build/memory-boundary (PR #288).

Excerpt: at f6fbdd5082f549f6c00df7a617d6b6313c01de19 the ci run 42660691865, test job 129311130753, succeeded 17:02:24Z to 17:03:04Z: "guards the PR reaches (scripts/ci/pr-tests.mjs)" success, "npm test, every guard" skipped by that selection, "plan check" success. At 40dc78dd706dc13ec7a6a08f5a4ba5e52b1e30cf the test job 129303303384 succeeded. The gates job at f6fbdd50 (run 42660691933) reads the previous verdict, whose world line was NOT MET; this verdict replaces it, and both checks run again on the verdict commit, which changes only verify/memory-boundary/.

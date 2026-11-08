# ci

`pull_request_read get_check_runs` and `get_job_logs` on PR #263, head ae70217b923d39bba381423bcafba64ae3cda3ea,
read at 2026-11-08 14:12Z:

- test job 128753421690: success. npm test: tests 2117, pass 2105, fail 0, skipped 12. `node plan/check.mjs`: 8
  stages, 108 items (97 live), 90 ledger rows, 17 cases; plan ok.
- gates job 128753421137: failure at 14:02:38Z, before any verdict existed at the head; the gates run again on the
  verdict commit, which changes only verify/item-writer-gaps/.

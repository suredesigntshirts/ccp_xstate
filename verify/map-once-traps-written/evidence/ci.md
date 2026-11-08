# ci

`pull_request_read get_check_runs` and `get_job_logs` on PR #220 at head d9e142f7dc7235d4c964a5c364bdf942afc76afb:

- test, job 128708711185 (run 42473238364): success. `# tests 1902 # pass 1885 # fail 0 # skipped 17`;
  `node plan/check.mjs`: "8 stages, 96 items (85 live), 90 ledger rows, 17 cases / plan ok".
- gates, job 128708710433 (run 42473238324): failed only with "verdict gate failed (item map-once-traps-written):
  no verify/map-once-traps-written/verdict.json at the head sha". It reruns on the commit that adds this verdict, which
  changes only verify/map-once-traps-written/.

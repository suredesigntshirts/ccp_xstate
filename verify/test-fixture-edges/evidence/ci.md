# ci

Read with the GitHub check runs for PR #210 at af64a367c242b66cf968aad168b40e5141d029a3 (get_check_runs, get_job_logs).

```
test (ci): success 10:30:11-10:35:08Z  # tests 1886 # pass 1869 # fail 0 # skipped 17; plan ok
clean-room: success
gates: failure: verdict gate failed (item test-fixture-edges): no verify/test-fixture-edges/verdict.json at the head sha
```

The verdict commit supplies the missing file; its own ci and gates runs decide the line.

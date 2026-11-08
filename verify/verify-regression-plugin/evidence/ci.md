# ci

Command: PR #232 check runs at a95b6c80e7d567730376ca743833154514212acf (GitHub MCP get_check_runs, get_job_logs).

Excerpt: test (ci) success, job 128730533720 (run 42480289250), 12:26:51-12:35:25Z. The gates job 128730533612 failed only at the verdict step, because the verdict on the branch then named db2ba7e and later commits (e9f03d7, 1daa82f, a95b6c8) changed the item. stubs, freeze and evidence passed. This verdict commit is what gates reads.

Earlier heads: at 142b5ac ci failed (stage-record passed 0 without Playwright, plus main's 230-line reds). At e79d252 and e9f03d7 it failed on live-capture's cheap timing test inside the moved-pass suites.

# ci

Command: PR #232 check runs at db2ba7ec736ea81865f13c8833118f992b8dba1f (GitHub MCP get_check_runs, get_job_logs).

Excerpt: test (ci) success, job 128718048633 (run 42476214328), 11:32:42-11:38:31Z. gates job 128718048771 failed only at the verdict step: `no verify/verify-regression-plugin/verdict.json at the head sha`; stubs, freeze and evidence passed. This verdict commit is what gates reads.

Earlier: at 142b5ac ci failed (run 42474983356): main's nine 230-line failures, and verify/verify-regression-engine/moved-pass because test/regression/inspector/stage-record.test.mjs passed 0 without Playwright.

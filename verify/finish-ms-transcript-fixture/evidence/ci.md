# ci

Command: GitHub MCP `pull_request_read get_check_runs` and `get_job_logs` on PR #269.

Inputs: head c21887e36730ee64dd83476fcd73fbb510c5889c.

Excerpt: test job 128766263482: success (14:53:40Z to 15:05:08Z). clean-room job 128766263762: success. gates job
128766263870: failure, with the one message `no verify/finish-ms-transcript-fixture/verdict.json at the head sha`. It
reruns on the verdict commit, which changes only verify/finish-ms-transcript-fixture/.

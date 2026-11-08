# world-refuses

Throwaway PR https://github.com/suredesigntshirts/ccp_xstate/pull/226, branch throwaway/verdict-cutoff-world from
5005ddad872eb02941838cd88ceb900dbd7ef49a: commit 60c6365 adds verify/verdict-cutoff-at-verified-sha/verdict.json with verified_sha 5005ddad872eb02941838cd88ceb900dbd7ef49a; commit
bc998b127b98796ac37f7d5c4e1a720d707c6c97 rewords the plan-passes Expect check ("passes at the head" -> "passes at the
head sha"). Body: "Item: verdict-cutoff-at-verified-sha". gates job 128709844029 (run 42473589588), read with
get_job_logs; PR closed unmerged. Deleting the branch from this session failed ("the remote end hung up"), so it is
left for the person.

Excerpt, step "verdict at the head sha, from a separate session, its named tests run":
"verdict gate failed (item verdict-cutoff-at-verified-sha): ... the contract of verdict-cutoff-at-verified-sha moved
after the verified sha 5005dda (expect); a verdict holds only for the contract it verified, so verify again at the head
... ##[error]Process completed with exit code 1."

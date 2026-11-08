# ci

PR #189 check runs at 25dddc9d60b3658e97d46ca9b8981630b73712bd: `test` 128676525480 success (08:29-08:32Z);
`gates` 128676525391 failure, because no verdict existed yet. The gates job reruns on the verdict commit, which
changes only verify/verification-contract/; its result is read before the verdict is posted on the PR.

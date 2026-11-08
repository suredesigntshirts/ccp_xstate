# ci

Read with the GitHub API (`repos/suredesigntshirts/ccp_xstate/commits/82c86117f65646132646540b8006bed66aa2b2a4/check-runs`, PR #227) on 2026-11-08 ~11:35Z:

    test   completed success  https://github.com/suredesigntshirts/ccp_xstate/actions/runs/42475896587/job/128717079386
    gates  completed failure  https://github.com/suredesigntshirts/ccp_xstate/actions/runs/42475896509/job/128717079117

The gates log at 82c86117f65646132646540b8006bed66aa2b2a4: "verdict gate failed ... the contract of fix-trace-writes-clone-cwd moved after the verified
sha 6472dc6", i.e. red only because the verdict then on the branch named an earlier head. The commit carrying this
verdict.json is where the verdict check runs with it; that run is the record for its half of this line.

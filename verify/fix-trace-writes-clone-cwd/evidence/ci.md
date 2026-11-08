# ci

Read with the GitHub API (pull_request_read get_check_runs, PR #227) at head 6472dc6bd76d43db4c6ace82f857f15403020abc on 2026-11-08 ~11:15Z:

    test   completed success  https://github.com/suredesigntshirts/ccp_xstate/actions/runs/42473993435/job/128711102556
    gates  completed failure  https://github.com/suredesigntshirts/ccp_xstate/actions/runs/42473993458/job/128711102950

The gates job (verdict.yml) log at that head: "verdict gate failed (item fix-trace-writes-clone-cwd): no
verify/fix-trace-writes-clone-cwd/verdict.json at the head sha" -- red only because no verdict existed yet; the commit carrying this
verdict.json is where it runs with one. The verdict check at that commit is the record for its half of this line.

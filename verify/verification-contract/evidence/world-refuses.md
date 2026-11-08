# world-refuses

PR https://github.com/suredesigntshirts/ccp_xstate/pull/191 "throwaway: ready item whose Expect line pins main",
branch throwaway/verification-contract-world, commit d40cfd15a6ec432d60ff68cdac442599f9e4cb65 on 25dddc9, adding
ready plan/items/throwaway-pins-main.md whose Expect renders-pinned check is "Every stage renders to main's bytes".
ci job 128677782456 (run 42463543957), log read with get_job_logs; PR closed unmerged 2026-11-08.

Excerpt from the `node plan/check.mjs` step:
  8 stages, 87 items (76 live), 89 ledger rows, 17 cases
  items/throwaway-pins-main.md: Expect renders-pinned pins main with "main's"; name the behaviour to show instead (plan/README.md, How slop is kept out)
  items/throwaway-pins-main.md: Expect renders-pinned pins main with "bytes"; name the behaviour to show instead (plan/README.md, How slop is kept out)
  ##[error]Process completed with exit code 1.

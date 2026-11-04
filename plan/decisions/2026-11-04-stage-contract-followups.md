# Stage contract follow-ups (2026-11-04)

engine-stage-contract merged as PR #74. The separate verifier session marked all five Expect lines MET at b829ff0
(`verify/engine-stage-contract/verdict.json`). This replan records what that merge settles and what it leaves open.

## Settled

- **engine-stage-contract is done.** Released as harness-v0.1.18 (the engine is a released file of the harness plugin).
- **fix-workflow-pinned is done.**
  - PR #74 pins each item to `name@<sha256>` at start, stores the bytes in `<root>/blobs`, and runs the filed spec
    for the item's life (`workflowOf`).
  - Its case, C-builder-cannot-change-own-workflow, has a passing parity test,
    `packages/engine/test/parity/C-builder-cannot-change-own-workflow.test.js`. Its gaps.json entry and its `.gap`
    characterisation test are gone, as that item's `why` asks.
  - It is done by PR #74 rather than by a PR of its own: the pin is part of the adopted design
    (`plan/decisions/2026-11-04-stage-contract-port.md`).
  - Two parity gaps remain: fix-finish-closes-waits and fix-waiting-wake.
- **inspector-stage-record is ready.**
  - Both items it depends on are done.
  - Its start branch is pushed (c6b7542).
  - Its Verifier brief is written.
  - Its sources must be re-pointed at main's runs. That is build work and is named in its inputs.

## Open, now plan items (draft)

- **fix-verify-issue-echo.** The adopt trial's only refusal was `restated`: the verify Schema requires only `url` and
  `expect`, while the host compares every key of the input issue. The Schema and the rule should agree.
- **trial-fail-path.** No real model has taken the FAIL path (verify FAIL, then a rebuild with the verdict) or the
  blocked path. The adopt trial's brief writer caught the planted half-met line itself. The next trial needs a failure
  that only running the code reveals.

## Open, recorded here only

- **N3: stage agents inherit this host's ambient instructions.**
  - In trial 2, and again in the adopt trial, the builder put the orchestrating session's `Co-Authored-By` and
    `Claude-Session` trailers on its commit. The PR body also got the orchestrator's footer, though no stage prompt
    asks for either.
  - This is a host fact, not an engine bug. The contract's claim is that what the prompt says is all the harness
    tells the agent, and that claim still holds. What does not hold is the assumption that nothing else reaches the
    agent.
  - No item for now. The trailers are accurate about which session ran the agent, and nothing reads them.
  - What would change this: a gate or a page that reads commit trailers to attribute work to a run, or a need for the
    harness to own attribution. Then a stage rule, or a host-written trailer, would be an item.
- **Brief commands are not dry-run.**
  - In the adopt trial, the brief's check 3 put a regex inside bash double quotes, so the command could not run as
    written.
  - The verifier saw this, reported it, and reran the command quoted correctly.
  - Nothing in the contract runs a brief's commands before the brief is fixed.
  - Recorded as a risk on the brief stage. It becomes worth an item if a verifier grades a line FAIL, or PASS, because
    of a broken brief command.

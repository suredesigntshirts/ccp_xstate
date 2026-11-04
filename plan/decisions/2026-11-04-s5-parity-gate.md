# s5 gate: cases-pass met, measured not met, so s5 is not passed

**Date:** 2026-11-04
**Decided by:** the "Judge the s5 stage gate" thread, as the person's stand-in (two-way door; the person authorized a
stand-in on 31 Oct and said on 4 Nov that threads never wait on them)

Stage `plan/stages/s5-parity.md` has two gate lines. Judged at main `11e0c34` (fix-waiting-wake done, harness-v0.1.21).

## cases-pass: MET

The check: "Every live case has a passing test". Its `how`: `npm test`.

- `plan/cases/` holds 17 cases (all in `work-item.md`; none is marked otherwise, so all are live). Each has a test
  named by its id in `packages/engine/test/parity/`, and `gaps.json` is empty. The listing test (`cases.test.js`)
  holds that every case has a test or a gap entry, never neither or both.
- `node --test packages/engine/test/parity/*.test.js` in a fresh clone after `npm ci`: 40 tests, 40 pass, none
  skipped. The 38 case tests each state the case's outcome, and several carry a control (the same input without the
  fault changes nothing, or merges).
- Full `npm test` locally: 687 tests, 675 pass, 11 skipped, 1 fail. The skips are tournament-lane tests that need
  lane checkouts absent here; none is a parity test. The one failure is `copy-not-link` (setup installs the newest
  release), a known local-only failure from the container's clone; it is not a parity test. CI on main at `11e0c34`
  is green (ci run 41927165616), so the suite passes where the gate is read.
- **The tests can fail.** To check they assert the case and not a stub, the thread broke the engine three ways in a
  scratch worktree, one case each, and ran that case:
  - dropped the head match from quick-fix's `verifiedHead` guard: `C-verdict-on-old-head` went red (its control
    stayed green);
  - made `refusal()` in `packages/engine/src/host.js` accept a completion for a run not in flight:
    `C-stale-completion-dropped` went red;
  - turned off the older-release check in `packages/journal/src/index.js`: `C-older-writer-refused` went red (its
    control stayed green).
  A first, narrower mutation (only the invoke-id half of the in-flight check) left the stale case green, because a
  replaced run is no longer in the host's runs at all, so the other half alone refuses it. That is redundancy, not a
  hole.

Reading stated plainly: the gate's `how` is `npm test`, and the cases' tests run under the engine's stubbed world
(`world.js`), not real agents. That is what "a passing test" asks for. Real-model coverage of the FAIL and blocked
paths is the draft item trial-fail-path, not this gate.

## measured: NOT MET

The check: "Concepts, refusals, person taps, time and tokens per item are reported for v1 and v2". Its `how`: "The
comparison page". No comparison page exists. It is the output of parity-compare, which is a draft and waits on:

- second-workflow (draft), whose pick is in `waiting-for-person.md`;
- v1's numbers, exported from the ccp_machine project. This project can't read that project's Library, so a thread
  there has to export them (parity-compare's `person_prereqs`). Added to `waiting-for-person.md`.

## So

Stage s5 is **not passed**: `cases-pass` holds, `measured` waits on parity-compare. Nothing in s5 depends on the
gate itself (items depend on items), so trial-fail-path and the new draft fix-reminder-wake can go ahead.

## Follow-up drafted

`plan/items/fix-reminder-wake.md` (draft): a send_later reminder reaches the session as a scheduled-trigger
notification in a ReadNotifications result, not as a `<wake>` prompt, and `bin/host.js`'s `wakeTextOf` keeps only
`github_webhook` notifications, so the reminder fires no timer unless the session wraps it as a wake by hand (the
fix-waiting-wake verifier had to). C-waiting-does-not-stall passes because the test feeds the wake directly.

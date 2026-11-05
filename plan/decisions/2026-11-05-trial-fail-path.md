# Fail-path trial: how each trial is forced onto its route (2026-11-05)

Item: trial-fail-path. Two-way doors, decided by the building thread as the person's stand-in.

## Why the routes need forcing

Trial 1, trial 2 and the adopt trial all merged on the first build. In the adopt trial the issue planted a half-met
line (README documents every export, while the seed README skipped `subtract`), and the brief writer read the repo,
saw it, and told the builder to document `subtract`. A trap any reader of the repo can see is defused before verify.
The blocked route has never been taken by a real builder at all.

## Decisions

1. **Fail trial: inject build 1, keep every other run real.** The driver answers the first build run itself with a
   recorded build that meets every expect line but one, pushed to the run's branch and opened as a PR through the
   same `gh` shim. Verify 1, build 2 and verify 2 are real agents given exactly their prompts. The route that matters,
   a verifier finding a FAIL and a builder fixing it from the verdict alone, is then taken by real models every time
   the trial runs, instead of depending on a builder getting something wrong. A natural failure (a bug only running
   reveals) was weighed and set aside: a real builder runs `npm test`, and a trap good enough to fool it would also
   be the kind the brief writer reads first. The injected run is marked in the report and its diff kept in `run/`.
2. **Blocked trial: the origin refuses pushes that change `.github/workflows/`.** The issue asks for a CI matrix
   change, and the local bare origin's pre-receive hook rejects the push with GitHub's own text for a token without
   the `workflow` scope. The build stage's rules already say to return `blocked` when a push is refused. Only the
   builder pushes, so the brief writer cannot defuse it. This is a real GitHub behaviour (v1 met it), not a made-up
   refusal.
3. **Both trials reuse the adopt driver**, copied into each trial's `driver/` with its issue, seed repo and, for
   blocked, the hook changed. Fake GitHub, local origin and real `npm test` as CI, as before.
4. **Outputs live beside the adopt trial** under `tournaments/2026-11-04-stage-contract/trials/{fail,blocked}/`,
   since they are trials of the same contract.

# Scoring: 2026-11-04-stage-contract

Floors first: a lane qualifies only if it passes every floor. Then qualified lanes are laid side by side on every trade-off; a lane ranks above another only if it is at least as good on all of them and better on one.

## Floors

| Lane | Qualified | Failed floors |
|---|---|---|
| A-control | no | contractTests P1: result2.md: 0 contract tests (it has none); contractTests P2: result2.md: 0 contract tests (it has none); contractTests P3: result2.md: 0 contract tests (it has none); contractTests P4: result2.md: 0 contract tests (it has none); contractTests P5: result2.md: 0 contract tests (it has none); contractTests P6: result2.md: 0 contract tests (it has none); constraints prompt-in-json: brief instructions stay in engine code (critique fix 1: P); promptInEngine 10787 bytes; constraints load-check: no load-time check for stage parts; the control has no stage parts; constraints fixed-parts: critique fix 3 (data rule everywhere): P; constraints brief-fills-task: no task part; the brief is not confined to one; constraints verify-covers: critique fix 2 (one result per Expect line, host checks coverage): N |
| S-six-parts | yes |  |
| M-minimal | yes |  |

## Trade-offs (qualified lanes only)

| Lane | primitives (lower is better) | promptInEngine (lower is better) | trials (higher is better) | Ranks above |
|---|---|---|---|---|
| S-six-parts | 13 counted (13 weighted), 13 special | 8471 | 2 passed of 2 | M-minimal |
| M-minimal | 14 counted (14 weighted), 12 special | 9021 | 0 passed of 0 | none |

Tiers (tier 1 holds the lanes no other qualified lane beats; each later tier holds lanes beaten only by lanes in earlier tiers): 1. S-six-parts  2. M-minimal

### S-six-parts: primitives

Counted: normal state, invoke onDone/onError, set, meta.actors, meta.input, effect run, effect stop, xstate.done/error events, accept-time check, stage part rules, stage part task, stage part inputs, checkStages (load-time check)

Special cases (not counted):
- final state: used by no model stage
- list-form invoke: used by 1 of 8 model stages (not quick-fix/brief, quick-fix/build, quick-fix/verify, feature/brief, research/brief, research/write, research/verify); used in one workflow (research)
- on: used by no model stage
- guard present: used by no model stage
- guard same: used by no model stage
- guard in: used by no model stage
- meta.needs: used by no model stage
- meta.events: used by no model stage
- github.<kind> events: used by no model stage
- ref handle: used by 1 of 8 model stages (not quick-fix/brief, quick-fix/verify, feature/brief, research/brief, research/researcher, research/write, research/verify)
- child item: used by no model stage; used in one workflow (feature)
- pin (load-time check): used by no model stage
- covers (field attribute): used by 2 of 8 model stages (not quick-fix/brief, quick-fix/build, feature/brief, research/brief, research/researcher, research/write)

### M-minimal: primitives

Counted: normal state, invoke onDone/onError, set, meta.actors, meta.input, effect run, effect stop, xstate.done/error events, accept-time check, meta.stages key, stage rules (meta.stages.X.task), input meanings, task invoke input, stageProblems (load-time check)

Special cases (not counted):
- final state: used by no model stage
- list-form invoke: used by 1 of 8 model stages (not quick-fix/brief, quick-fix/build, quick-fix/verify, feature/brief, research/brief, research/write, research/verify); used in one workflow (research)
- on: used by no model stage
- guard present: used by no model stage
- guard same: used by no model stage
- guard in: used by no model stage
- meta.needs: used by no model stage
- meta.events: used by no model stage
- github.<kind> events: used by no model stage
- ref handle: used by 1 of 8 model stages (not quick-fix/brief, quick-fix/verify, feature/brief, research/brief, research/researcher, research/write, research/verify)
- child item: used by no model stage; used in one workflow (feature)
- pin (load-time check): used by no model stage

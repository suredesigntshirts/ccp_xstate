# A grant answers the blocked card (2026-11-05)

Item: fix-blocked-card-grant. Two-way doors, decided by the building thread as the person's stand-in, when the item
went ready.

## What happens today

`standinInput()` (packages/engine/src/standin.js) checks a grant's `repos` against `repoOf(run.input.pr.url)`. The
merge cards carry `pr`; quick-fix's `blocked` card carries only question, choices and failure, because no PR was
opened. So every grant is refused `repo (none) not granted`, and only a tap answers the card
(verify/fix-blocked-retry/retry.test.mjs, its note test). `bin/host.js answer` also gives no `why`, and quick-fix's
`replan` guard needs `event.output.why`, so a covered stand-in replan would be refused by the chart.

## Decisions

1. **A card with no PR takes its repository from the item's issue.** The repository is the card's `pr` repository when
   the card has a `pr` input (unchanged), else `owner/repo` of the item's `context.issue.url` when that is a
   `https://github.com/<owner>/<repo>/issues/<n>` URL, else none (refused, as today). Of the three sources the draft
   named, the issue is the only one set by whoever started the item rather than by an agent: the clone's origin is not
   in the host's view, and a `repo` the builder returned would let the agent that was blocked name the repository its
   own retry is checked against. Reading it in standin.js and not from a new card input keeps quick-fix.json, its
   pinned hash and every done suite's snapshot unchanged, which fix-blocked-retry had to re-capture (its decision 9).
   The refusal names the source it read (`issue o/r`, `pr o/r`, or none).
2. **The rule is per card, not per state.** Any card with no PR reads the issue, so `replanning`'s card becomes
   grantable too. Nothing widens by itself: a grant still names its choices, and the only grant so far names
   `approve` and `reject`. Keeping the rule to `blocked` alone would put a state name into standin.js, which knows
   nothing of quick-fix's states.
3. **A grant may name retry.** The engine can't see whether the block was cleared, and doesn't try: the stand-in
   clears it (or knows it is cleared) before answering, as a person does before tapping. A retry that blocks again
   reaches `replanning` with no retry left (fix-blocked-retry decision 3), so a wrong retry costs one build. Clearing a
   block that is a one-way door (a token scope, a setting) stays the person's, and goes in waiting-for-person.md.
4. **`answer --why`.** A non-empty `--why` is added to the answer's output as `why`. No special case for replan: the
   chart's own guard refuses a replan with no why, and the host refuses an event the chart does not take.
5. **The done suite's gap test is changed, not deleted.** verify/fix-blocked-retry's note test asserted the gap this
   item closes; it now asserts the same grant is taken. That is the only change to a done suite.

## After the build

Build PR #144 merged at 2a024de. The verifier thread (session_01KfkB5GR9FLaAKoj1hQt7ZX) found all 4 Expect lines MET
at d4bf39e (verdict commit 813c05c), driving the blocked card through `bin/host.js answer` with its own grants files.
Released as harness-v0.1.31 (Actions tagged it on merge).

- **Found while building:** a stand-in answer the chart turned away (a replan with no why) was journalled and refused,
  and the same grant's next answer on that card came back `duplicate`, because the answer's source ref is the grant
  and the card. `standinInput` now asks the chart (`snapshot.can`) first and refuses before anything is written.
- **Verifier note, left as is:** a grant whose `repos` holds JSON `null` covers every card with no repository,
  because `repos.includes(null)` is true. Main behaves the same way. Grants are written by the person, a null is not
  a repository anyone would list, and the first grant names repos as strings; if a grant is ever written by a tool,
  that tool should refuse non-string repos.

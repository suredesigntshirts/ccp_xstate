# Adopt lane S's stage contract, though it failed the primitive rule (2026-11-04)

Plan items `engine-stage-contract`, `inspector-stage-record` and `tournament-scoring-floors`. The person deferred the
architecture call to Claude; this is a two-way door (the engine can be rebuilt from lane A again, and the tournament
record keeps every lane), so it is decided here and written down.

## The question and what the tournament said

The [2026-11-04 stage-contract tournament](https://github.com/suredesigntshirts/ccp_xstate_scratch/issues/44) asked
whether declaring every model stage in the workflow JSON, and rendering every prompt from those declarations, makes
lane A simpler and fixes the stage-by-stage prompt critique at the root. Lane A
([tourney/2026-11-03-context/A-minimalist](https://github.com/suredesigntshirts/ccp_xstate_scratch/tree/tourney/2026-11-03-context/A-minimalist),
23c3290) won the first tournament by deletion and was the control.

After two rounds, both contract lanes passed all 12 scenarios and all six contract tests. Lane S fixed 10 of the 14
critique items by construction, lane M 8, the control none. Both counted 26 weighted primitives against the control's
22. The rule written before the run qualified only lanes at or below 22, so the judge's formal answer was "no", and
the judge added that the contract is a good prompt design that is not a simplification
(`tournaments/2026-11-04-stage-contract/result2.md` once it lands; today
`/mnt/project-files/stage-contract-tournament/result2.md`).

## Decision

Adopt lane S as cleaned up on
[tourney/2026-11-04-stage-contract/S-cleanup](https://github.com/suredesigntshirts/ccp_xstate_scratch/tree/tourney/2026-11-04-stage-contract/S-cleanup)
at c62f5ac, as main's engine and workflows (item `engine-stage-contract`). Change tournament scoring so this kind of
miss cannot recur (item `tournament-scoring-floors`).

## Why, from first principles

The harness exists to run work through stages that a person can trust without reading every transcript. For that,
each stage must be something the person can see, measure and change on four points: the instructions it got and where
each came from, its input data and what each input means, its output, and where that output goes next. A design that
cannot answer those four is not simpler; it moves the work to the person, who must reconstruct them by hand. That is
what workflow-inspector found on main: the brief actor's prompt is an engine template with no authored instructions,
and nothing records where a value came from.

The control is cheaper because it answers fewer of those questions, not because it answers them more economically.
Its prompts are built in engine code, its inputs carry no meaning, its verifier returns free text that nothing checks
against the Expect lines, and it records no data flow. A primitive count cannot see any of this, because a missing
capability costs zero primitives. Ranking on the count first therefore rewards leaving the job undone. The right order
is: first, does the design do what the stage must do (the floors); then, among designs that do, which costs least on
several measures side by side.

On that order, S is the choice. It passes every floor; among the qualifying lanes it has the least prompt text in
engine code (8471 bytes against M's 9021 and the control's 10787); and it is the only lane with real-model evidence.

## What the primitives cost, and what each buys

Round 2 already put S at +4 weighted over the control: the three stage parts (`rules`, `task`, `inputs`, later two
parts plus the reserved `task` input), the `covers` attribute and the load check, less the role-from-schema convention
it deleted. Each buys a critique fix: instructions authored in JSON and refused when missing, one result per Expect
line, a meaning for every input.

The cleanup added **+9** strict, counted against round 2's beae336 (`S-cleanup/notes.md`, section H):

| Primitive | What it buys |
|---|---|
| reserved input `task` fills the Task part (net 0: the `task` part was removed) | the Task is traced like any other input, so the record shows which run wrote it |
| C: an invoke must name a stage, an effect or a workflow | a workflow pinned before the contract is refused at load with a message, instead of no handler taking its runs |
| D: a stage given lines whose output may say PASS/FAIL, or that the chart decides on, declares `covers` | coverage cannot be switched off silently; the verifier found five rounds of respellings that escaped narrower rules |
| E: every invoke input is fed on some way into its state | dangling wiring (`issue.expectt`, a read before any write) is refused at load, not discovered as a null at run time |
| form rule: every action is a `set` on a transition the chart walks | entry, exit, always and other hidden writes cannot bypass D, E or the record |
| `EFFECTS` list | C knows which names are host effects; drift fails at import |
| `wrote` marker action | the host can see what each transition wrote, which XState does not return |
| `writes` on `engine.transition` rows | data flow is in the journal, so the record is derived, not a second source |
| run handler hook `finished` | the record learns which onDone branch was taken and what it wrote, including for stopped runs |
| `stage.json` format with producer kinds | the four questions answered per run, in one file the inspector reads |

Five of these are the plumbing the record needs; four are load rules that turn a silent failure into a refusal. None
adds anything a workflow author writes: the author still writes rules, inputs, the output schema and `covers`.

The trial fixes added **+1** net: `oneOf` in the schema subset and a reserved `blocked` output (+2), which gives a
stage an honest "I could not" routed as its error to replanning; build's unread `notes` field removed (−1).

## What the trials showed

Two real-model trials ran lane S end to end on a local repo with a fake GitHub and real `npm test` as CI
(`trial/report.md`, `trial2/report.md`).

- **Trial 1** (aac5572) merged on the first build with one refusal: the builder returned a prose PR url, because
  nothing told it how to open a PR or what the url looks like. It found nine problems, among them no honest "could
  not" return, stricter checks written into PASS/FAIL, line order not enforced, and the run line shown twice.
- **Trial fixes** (8d51cbf) closed them in the contract: build rules name the GitHub tools and url shape, a `prRef`
  schema, `blocked`, order enforced by `covers`, the run line once in the context, the Advisory route.
- **Trial 2 fixes** (c62f5ac): build `notes` returned, wired only to the two merge cards (the card effect now passes the ask's inputs, which before reached no person), and the PR rule asks for a title and body that say how each expect line is met. Net primitives 0.
- **Trial 2** merged on the first build with **0 refusals**. Every agent's first return was valid; the brief writer
  put stricter checks under Advisory and the verifier kept them advisory.

What the trials did not show: the FAIL path (verify FAIL, rebuild) and the blocked path have not been taken by a real
model. And N3: a stage agent picked up the parent session's commit-trailer instructions, which the stage prompt never
gave it, so the prompt is not all an agent is told on this host. Both are named risks in `engine-stage-contract`, and
its own trial must report them.

## What would reverse this

The door is two-way. Reverse it if, on main, the FAIL or blocked path fails with a real model in a way the contract
cannot express; if the load rules refuse real workflows faster than they catch real faults; or if the record goes
unread (the inspector item lands and nobody uses the Stage view). Lane A stays on the scratch repo as the fallback.

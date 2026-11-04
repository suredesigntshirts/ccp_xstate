```json
{
  "id": "tournament-scoring-floors",
  "title": "Score tournaments floors first, then on trade-offs",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "A tournament's config states its scoring as floors and trade-offs, and scripts/tournament scores it that way: a lane qualifies only if it passes the scenarios, the contract tests and the hard constraints; qualified lanes are then laid side by side on primitives (counting only primitives every model stage uses, in more than one workflow), the bytes of prompt wording left in engine code, and real-trial outcomes, with no single count deciding alone.",
  "why": "In the 2026-11-04 stage-contract tournament the rule written before the run ranked on weighted primitive count alone (qualify at or below the control's 22). That made the formal answer 'no' to lane S, whose extra primitives each closed a real failure the control left open (coverage of Expect lines, inputs without meaning, a verdict routed on without being checked), and qualified the control, which failed the critique the tournament existed to fix. A count is a cost; a floor is what the design must do. Ranking on cost before checking the floors rewards doing less.",
  "serves": [
    "L-count-concepts",
    "L-agents-self-report",
    "L-plans-need-independent-read"
  ],
  "depends_on": [
    "tournament-kit"
  ],
  "inputs": [
    {
      "ref": "scripts/tournament/ (args.mjs, measure.mjs, prompts/, schemas/)",
      "what": "The generic kit, where scoring is today one free-text rule"
    },
    {
      "ref": "/mnt/project-files/stage-contract-tournament/{result.md,result2.md}",
      "what": "The judge's application of the primitive-count rule, its sensitivity readings, and its own note that the contract is a good design that does not pay under the rule"
    },
    {
      "ref": "plan/decisions/2026-11-04-adopt-stage-contract.md",
      "what": "Why S was adopted against the rule, and what each of its primitives buys"
    },
    {
      "ref": "ccp_xstate_scratch tourney/2026-11-04-stage-contract/base, tournaments/2026-11-04-stage-contract/",
      "what": "That tournament's config and round-2 measure files, to re-score"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/tournament/score.mjs",
      "what": "Reads a tournament's config.scoring, scores.json and the judge's floors-and-primitives file; writes qualified lanes (with any failed floor named) and the trade-off table as JSON and Markdown"
    },
    {
      "ref": "scripts/tournament/args.mjs, schemas/judge.json, schemas/final-judge.json, prompts/judge.md, prompts/final-judge.md",
      "what": "config.scoring takes floors (scenarios, contract tests, hard constraints) and trade-offs; args.mjs refuses a scoring block without floors; the judge's schema records each floor per lane and each primitive with the stages and workflows that use it"
    },
    {
      "ref": "docs/tournaments.md",
      "what": "Scoring section: floors first, then trade-offs, and the primitive counting rule"
    }
  ],
  "expect": [
    {
      "id": "floors",
      "check": "A lane that fails any floor (one scenario, one contract test or one hard constraint) is reported as not qualified with that floor named, whatever its primitive count; a lane that passes all floors is qualified",
      "how": "The verifier's own toy tournament folder with three lanes, one failing each kind of floor",
      "proof": "verifier"
    },
    {
      "id": "primitive-rule",
      "check": "A primitive enters a lane's count only if every model stage uses it and it is used in more than one workflow; a primitive used by some stages or by one workflow is listed separately as a special case, never dropped silently",
      "how": "The verifier's own judge file with primitives on each side of the rule, run through score.mjs",
      "proof": "verifier"
    },
    {
      "id": "no-single-count",
      "check": "score.mjs ranks qualified lanes only through the trade-off table (primitives, prompt bytes in engine code, real-trial outcomes); a lane cannot rise above another qualified lane on one trade-off alone without the table showing all three",
      "how": "Read score.mjs and its output for the toy tournament",
      "proof": "verifier"
    },
    {
      "id": "rescore",
      "check": "Re-scoring 2026-11-04-stage-contract round 2 under the new rule reports A as not qualified (no contract tests), S and M as qualified, and a trade-off table holding both lanes' primitives under the counting rule, promptInEngine bytes (S 8471, M 9021) and trial outcomes (S: two merged real-model trials on its cleanup; M: none)",
      "how": "node scripts/tournament/score.mjs on that tournament's folder with a judge file written from result2.md",
      "proof": "verifier"
    },
    {
      "id": "args-refuse",
      "check": "args.mjs refuses a config whose scoring has no floors, and the existing 2026-11-03-context folder still builds args after its scoring is restated as floors and trade-offs",
      "how": "The builder's tests in scripts/tournament/test/",
      "proof": "builder"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "scoring floors (what a lane must do before its cost is compared)"
    ],
    "merges": [
      "the free-text scoring.rule into floors plus trade-offs"
    ],
    "budget": 1
  },
  "non_goals": [
    "No new tournament is run",
    "No change to measure.mjs's measures beyond what score.mjs reads",
    "No automatic counting of primitives from code; the judge still lists them, and score.mjs applies the counting rule",
    "No weighted composite score; the trade-offs stay side by side"
  ],
  "records": [
    "tournaments/<id>/scoring.json written by score.mjs: floors per lane, qualified lanes, the trade-off table"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, using the Verifier brief below.",
  "risks": [
    "A contract-test floor favours lanes built for the contract; a control that does not attempt the critique cannot qualify. That is intended when the critique is the question, and the pack must say so before the run.",
    "The counting rule (every model stage, more than one workflow) depends on the judge listing usage honestly; score.mjs can check the list against the workflow JSON only where measure.mjs reads it."
  ]
}
```

## Why floors first

The 2026-11-04 tournament ([scratch #44](https://github.com/suredesigntshirts/ccp_xstate_scratch/issues/44)) was
scored by the rule written before the run: qualify at 12/12 scenarios and at most the control's 22 weighted
primitives, then break ties. Lane S passed every scenario and every contract test and fixed 10 of 14 critique items by
construction; the control fixed none. S counted 26. So the formal answer was "no", and the only qualifying lane was
the one that did not do what the tournament asked. The judge saw this and wrote that the contract is a good design that
does not pay under the rule (`result2.md`, "Bottom line").

The fault is the order of questions. A primitive count measures what a design costs, not whether it works. Asking
"is it cheap?" before "does it do the job?" ranks the cheapest design that half-does the job above one that does it.
The fix asks the job first, as floors no lane can trade away, and only then compares costs, as several numbers side
by side, because no one number captures weight: S was heavier in primitives but lighter in prompt text left in engine
code (8471 bytes against the control's 10787), and only S had real-trial evidence.

## The primitive counting rule

A primitive counts only if every model stage uses it, in more than one workflow. The point is to count vocabulary, the
things an author must learn to write any stage, and to keep apart the one-off features a single stage or workflow
needs. One-offs are not free: they are listed as special cases beside the count, where the judge weighs them, rather
than added into a number that treats a general rule and a patch alike.

## Verifier brief

Read this item's head. Without reading the builder's tests, write a toy tournament folder of your own (any subject)
with three lanes: one that fails a scenario, one that fails a contract test, one that breaks a hard constraint, plus
one that passes all. Write a judge file listing primitives, some used by every model stage in two workflows, some by
one stage or one workflow. Run score.mjs and confirm the qualified set, the named failed floors, the counted
primitives and the special-case list. Read score.mjs to confirm no ranking comes from one trade-off alone. Write a
judge file for 2026-11-04-stage-contract round 2 from `result2.md` and the round-2 measure files (on the scratch base
branch, or on main once engine-stage-contract has landed) and re-score it; compare with the rescore line. Remove the
floors from a config and confirm args.mjs refuses. Read the ci check at this PR's head sha. Give a verdict per Expect
id.

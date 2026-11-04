# Tournament scoring: Pareto over trade-offs, usage listed per stage, the stage-contract folder lands here (2026-11-04)

Plan item `tournament-scoring-floors`. Why scoring is floors first is in the item and in
`plan/decisions/2026-11-04-adopt-stage-contract.md`. These are the two-way doors the builder thread decided:

- **Ranking is Pareto dominance, not a weighted sum or a lexicographic order.** The item forbids one count deciding
  alone. A fixed order of trade-offs (primitives, then bytes, then trials) would let the first one decide every case
  it separates, which is the old fault with extra steps; weights would be a composite score under another name. So a
  qualified lane ranks above another only if it is at least as good on every trade-off and better on one, and lanes
  neither beats share a tier. A missing value makes two lanes incomparable on that trade-off. The cost: ties are
  common, and the judge's notes, not a number, break them. That is intended; the table shows why.
- **The judge lists usage; score.mjs applies the rule.** Each primitive carries the model stages (`workflow/stage`)
  that use it, plus `workflows` for use outside any stage, and each lane lists its model stages. A primitive counts
  only if its stages cover all the lane's model stages and it reaches two or more workflows. Listing usage, rather
  than a yes/no "general" flag, keeps the judgement checkable: a reader can disagree with one usage line instead of a
  verdict. Counting from code stays a non-goal.
- **The judge's file is the judge schema's output, saved as `judge.json`.** The kit's `judge` and `final-judge`
  schemas now ask for floors, model stages, primitives and trials per lane, so a real run's structured output is the
  file `score.mjs` reads, with no hand transcription. `score` (a single number) is gone from both schemas.
- **A free-text `rule` alone is refused,** and prompts read `{{scoring.text}}`, which `args.mjs` writes from the
  floors and trade-offs. A prompt naming `{{scoring.rule}}` is refused at args time rather than failing mid-run. Old
  rules stay in `scoring.was` as record.
- **Trade-offs need at least two entries.** One trade-off would be a single count again.
- **2026-11-03-context restated** with the 12 scenarios and four constraints from its pack as floors (no contract
  tests: it predates them) and primitives, `specLines.total` and trials as trade-offs. Person taps were a hand-judged
  tie-breaker with no measure; the note says the judge weighs them in notes.
- **The 2026-11-04-stage-contract folder lands with this item,** copied from the scratch base branch with its scoring
  restated, a `judge.json` written from `result2.md`, and `scoring.json`/`scoring.md` from `score.mjs`. The rescore
  needs a config with floors, and landing the folder once avoids two copies. `engine-stage-contract` (which also lists
  this folder as an output) adds its trial reports and `trials/adopt/` into it rather than recreating it. The
  `judge.json` is the builder's reading of the round-2 judge's reruns, not a rerun; the verifier writes its own.
- **The control's contract-specific constraints are marked failed,** from `result2.md`'s critique table (fixes 1, 2
  and 3 not fixed by construction), as well as its six contract tests. That is what the pack asked of every lane.

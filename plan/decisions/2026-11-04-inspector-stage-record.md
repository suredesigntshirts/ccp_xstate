# Inspector stage record: where its sources live, and who wrote a stage prompt (2026-11-04)

Plan item `inspector-stage-record`. Why the inspector shows stage.json is in the item. These are the two-way doors the
builder thread decided:

- **Sources name durable places, not this container.** The start branch's `sources.json` named `/home/user/sc/*`
  checkouts and `/mnt/project-files/stage-contract-tournament/` journals, which exist only in the container that made
  them. A string engine or journal path is now relative to the repo root: main's engine is `"."`, the adopt trial is
  its committed journal, and main's own tourney scenarios (Q1, Q3, Q5, R1) replace lane S's. Repo-relative paths
  work in any clone, including the verifier's.
- **Older journals replay on the commit that made them, `{ "commit": "36da3e4…" }`.** Today's engine refuses a
  journal without a pinned contract workflow by design, so the October runs (first real issue, toy runs) can only be
  read on main before the contract. The test suite already did this with a worktree; build.mjs now does the same for
  any source, once per build. The alternative, keeping a checkout path like `/home/user/wi`, is not durable. A
  shallow clone without the commit skips the source and names why.
- **Lane S trials 1 and 2 are dropped from the default sources.** Their engines (lane S at aac5572 and 8d51cbf) live
  in the scratch repo, not this one, and the adopt trial on main's engine shows the same record on the shipped code.
  Their journals and reports stay in `/mnt/project-files/stage-contract-tournament/`; a person can add them back with
  a config naming a scratch checkout. Lanes A and C stay as they were on main (skipped where absent): out of scope.
- **Layer 2 reads "who wrote this prompt" from stage.json.** Without this, a stage-contract build run said "engine
  template, nobody wrote it" while its Stage view said the Task came from the brief agent: the old rule looks for
  `input.brief`, which the contract removed. The record names each Task piece's producer, so the page now credits
  that (the brief agent's field, or the workflow JSON literal) and keeps the old rules for runs without a record.
- **The default run is the first with stage records.** It shows the most; older sources still open by choice.

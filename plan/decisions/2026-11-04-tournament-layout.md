# Tournaments: generic runner plus per-tournament folders (2026-11-04)

**Asked (person, 03:04Z):** "How would you organize this clean in GitHub, so we can reuse the pattern?" Then (03:08Z):
"Yes, this looks good, but assume this won't be our only tournament we run ... does your organization still honor
should it be changed?"

**Decided:**
- Generic, subject-free tooling goes in `scripts/tournament/` (runner, args builder, measure, CI template, role prompts).
- Each tournament is a folder `tournaments/<date>-<topic>/` holding its pack, a `config.json` (base repo and sha,
  lanes, stages, scoring rule written before the run, runner sha), its shared suite or a pointer to one, its
  measure, and its result and scores. `tournaments/README.md` indexes them all.
- Lane code goes in ccp_xstate_scratch as `tourney/<id>/<lane>` branches cut from `tourney/<id>/base`, one draft PR
  per lane, labelled `tourney:<id>`, with one tracking issue, and is never merged. A single CI workflow on the base
  branch reads the tournament's config, so it serves every tournament without edits.
- A winner reaches main only as an ordinary plan item, rebuilt cleanly.

**Done so far:** the first tournament (2026-11-03-context) was pushed to scratch as base plus five lane branches,
draft PRs #37-#41 and tracking issue #36. The base is a history-free snapshot of main 5633401, because this clone is
shallow and the scratch repo lacks ccp_xstate's history. Item `tournament-kit` builds the rest.

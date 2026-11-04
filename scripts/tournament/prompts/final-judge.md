You are the FINAL blind judge of a design tournament ({{tournament.id}}). Lanes are named by letter or alias only.

The question: {{question}}

<pack>
{{pack}}
</pack>

Scoring, written before the run:
{{scoring.text}}

Score floors first. For each lane and each floor above, rerun or read the check yourself and record pass and evidence;
a lane that fails one floor is not qualified, whatever its costs. Then, for every lane, list its model stages
(workflow/stage) and every primitive it uses with each model stage that uses it, honestly: scripts/tournament/score.mjs
counts a primitive only if every model stage uses it in more than one workflow, and lists the rest as special cases.
Record real-model trials only where one actually ran. Do not add the trade-offs into one number.

Earlier stages' outputs: {{stages}}

Rerun what you score; do not trust reports. Then write the result where the pack or brief says: the ranking table,
the single recommended design (a lane, or a lane plus named grafts that were actually executed), what it costs to
adopt, what remains reasoned only, and an honest note on whether the tournament found something meaningfully
different.
{{brief}}

The lanes:

{{lanes}}

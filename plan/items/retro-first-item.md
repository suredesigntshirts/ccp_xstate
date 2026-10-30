```json
{
  "id": "retro-first-item",
  "title": "Learn from the first real item and splice the lessons into the plan",
  "stage": "s4-first-real-item",
  "kind": "research",
  "status": "draft",
  "outcome": "A short retro, from the journal, says what ran, what it cost, where it waited and what was refused, and every lesson is a new ledger row and, where needed, a new or changed plan item.",
  "why": "The ratchet: each observed failure becomes a rule, test or check. This is where the plan learns from v2 rather than v1.",
  "serves": ["L-findings-recent-case", "L-cost-asymmetry", "L-measure-then-park"],
  "depends_on": ["first-real-issue"],
  "inputs": [
    { "ref": "The item's journal and page", "what": "The evidence" }
  ],
  "outputs": [
    { "ref": "plan/research/retro-first-item.md", "what": "The retro" },
    { "ref": "New rows in plan/ledger/, new items in plan/items/", "what": "Spliced by the README rules" }
  ],
  "expect": [
    { "id": "numbers", "check": "The retro gives tokens, time by kind, rounds, refusals and person asks for the item", "how": "Numbers match the derived views" },
    { "id": "spliced", "check": "Every lesson in the retro has a ledger row, and the plan check passes", "how": "node plan/check.mjs" }
  ],
  "cases": [],
  "concepts": { "adds": [], "budget": 0 },
  "non_goals": ["No fixes"],
  "records": ["None beyond the files"],
  "person_prereqs": [],
  "step_back": { "max_rounds": 1 },
  "verifier": "A separate subagent recomputes the numbers from the journal.",
  "risks": []
}
```

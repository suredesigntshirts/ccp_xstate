```json
{
  "id": "first-real-issue",
  "title": "Finish one small real issue with v2 in a real Projects thread",
  "stage": "s4-first-real-item",
  "kind": "build",
  "status": "draft",
  "outcome": "A small real issue, chosen with the person, goes from filed to merged through v2, observed end to end, with the person asked only what the workflow says to ask.",
  "why": "The constraint after the skeleton is real use. A toy can't show waits on CI, real review findings or real refusals.",
  "serves": ["L-build-for-next-real-item", "L-checks-against-world", "L-attention-is-the-constraint"],
  "depends_on": ["engine-toy-run"],
  "inputs": [
    { "ref": "A real issue in ccp_xstate, picked with the person", "what": "The work" }
  ],
  "outputs": [
    { "ref": "The merged PR", "what": "The work done" },
    { "ref": "The item's journal and its observe-page view", "what": "The record" }
  ],
  "expect": [
    { "id": "merged", "check": "The PR is merged at the verified sha by the host", "how": "GitHub plus the journal" },
    { "id": "complete", "check": "The journal check is clean for every session that served the item", "how": "journal-check" },
    { "id": "asks", "check": "Every person ask on the item is one the workflow declares", "how": "Compare card.posted rows with the workflow's cards" }
  ],
  "cases": [],
  "concepts": { "adds": [], "budget": 0 },
  "non_goals": ["No fixes to v2 inside this item; problems found become new items"],
  "records": ["Everything, for one real item"],
  "person_prereqs": ["Pick the issue with the thread"],
  "step_back": { "max_rounds": 2, "max_tokens": 4000000 },
  "verifier": "The workflow's own verifier for the work. For this plan item, a separate subagent checks the three Expect lines from GitHub and the journal.",
  "risks": []
}
```

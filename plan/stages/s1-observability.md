```json
{
  "id": "s1-observability",
  "title": "See where time, tokens and refusals go",
  "order": 1,
  "status": "draft",
  "goal": "Every tool call, token, refusal and wait is recorded as it happens, tagged with its session, agent and (once items exist) item and step, and a page shows it.",
  "gate": [
    { "id": "live-journal", "check": "A session's events are in the journal while it runs, with no salvage step", "how": "Compare a test session's journal with its list_events log: every tool call present" },
    { "id": "answers", "check": "The page answers: where did the tokens go, where did the time go, what was refused and why", "how": "The person reads the page for one real session and names no missing answer" }
  ]
}
```

Observability comes before the engine so the engine's own build can be measured, and so v1 and v2 can be
compared on the same numbers.

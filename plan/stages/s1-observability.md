```json
{
  "id": "s1-observability",
  "title": "Record every call as it happens",
  "order": 1,
  "status": "draft",
  "goal": "Every tool call, subagent, wake and turn usage, plus each worker brief and result, is in the journal while the session runs, attributed to session and agent. Views and pages wait for the widen stage.",
  "gate": [
    {
      "id": "live-journal",
      "check": "A test session's journal holds a row for every tool call in the session's own log, with no salvage step",
      "how": "A fixture compare in obs-live-capture's tests, plus one real session compared by hand"
    }
  ]
}
```
Thin on purpose: capture now, views later. The person asked for observability before the XState work; this is the
part of it every later item needs. Derived views and the page move to s4b-widen (plan-review finding 1).

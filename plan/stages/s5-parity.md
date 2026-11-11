```json
{
  "id": "s5-parity",
  "title": "Pass the cases v1 met",
  "order": 5,
  "status": "draft",
  "goal": "v2 passes every case in plan/cases/, and a second workflow runs real work.",
  "gate": [
    {
      "id": "cases-pass",
      "check": "Every live case has a passing test",
      "how": "npm test"
    },
    {
      "id": "second-workflow",
      "check": "A real item ran through a workflow other than quick-fix",
      "how": "second-workflow's verdict"
    }
  ]
}
```

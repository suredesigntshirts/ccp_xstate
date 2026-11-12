```json
{
  "id": "fix-time-ci-from-notifications",
  "title": "Count CI waiting when the check result comes through ReadNotifications",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "module": "packages/journal/src/derive/time.js",
  "outcome": "time labels a gap ci when the turn that ends it starts by reading a GitHub check result through ReadNotifications, as it does for a wake that carries one.",
  "why": "In threads, PR events mostly arrive as a short notice to call ReadNotifications, and the check result is in that tool's output, which makes no wake row. second-workflow's verifier noted that time's ci label reads only UserPromptSubmit wakes, so most real CI waiting still shows as wake.",
  "serves": [
    "L-harness-overhead"
  ],
  "depends_on": []
}
```

From the second-workflow verdict's observations (11 Nov). Capture's tool.call row for ReadNotifications would need to
say whether its result held a check event, as the wake row's `checkEvent` does.

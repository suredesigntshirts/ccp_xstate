```json
{
  "id": "s0-environment",
  "title": "Bootstrap the environment",
  "order": 0,
  "status": "draft",
  "goal": "A fresh Claude Project installs the v2 plugin from this repo alone, and every session starts with its tools, rules and versions checked and recorded.",
  "gate": [
    { "id": "fresh-install", "check": "A new thread in a new project with only this repo installs the plugin and passes its start-of-session self-check", "how": "The self-check's report in that thread, plus the recorded fingerprint" },
    { "id": "no-self-edit", "check": "Updating the plugin never needs a thread to edit the plugin or settings it is running", "how": "An update from version N to N+1 lands through a version bump and the next session reports N+1" }
  ]
}
```

The bottleneck before anything else: v1 lost hours to rules that hadn't loaded, stale installs and
threads refused for editing their own plugin. Nothing later is trustworthy until a session can say what it
is running and that its tools work.

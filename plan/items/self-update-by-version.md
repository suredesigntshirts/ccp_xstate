```json
{
  "id": "self-update-by-version",
  "title": "Update the harness by releasing a version, never by editing the running plugin",
  "stage": "s4b-widen",
  "kind": "build",
  "status": "draft",
  "outcome": "A merged plugin change becomes a numbered release, the next session in the project loads it, and its fingerprint shows the new release; no session edits the plugin it runs.",
  "why": "Auto mode refuses a thread editing the plugin or settings it runs, and plugins load only at session start. So self-update has to be a release that the next session picks up, with the fingerprint proving it.",
  "serves": [
    "L-no-self-modification",
    "L-plugins-load-at-start",
    "L-version-every-session",
    "L-copies-carry-lineage"
  ],
  "depends_on": [
    "retro-first-item"
  ],
  "inputs": [
    {
      "ref": "ccp_machine plugins/harness scripts (notice-behind, clone refresh)",
      "what": "v1's behind-notice and fast-forward of a clean clone"
    }
  ],
  "outputs": [
    {
      "ref": ".github/workflows/release.yml",
      "what": "On merge to main with a plugin change: bump the version, tag it"
    },
    {
      "ref": "plugins/harness/hooks/ (UserPromptSubmit)",
      "what": "At most every 30 minutes, says when a newer release exists"
    },
    {
      "ref": "setup.sh change",
      "what": "Installs the newest release at container build and fast-forwards a clean clone at session start"
    }
  ],
  "expect": [
    {
      "id": "release",
      "check": "A merge touching plugins/ produces a tag and a higher version; a merge not touching it doesn't",
      "how": "Workflow test with act, or two test PRs on a scratch repo"
    },
    {
      "id": "behind-notice",
      "check": "A session on release N while N+1 exists is told so once per 30 minutes",
      "how": "Hook test with a stubbed latest release"
    },
    {
      "id": "no-self-edit",
      "check": "Nothing in the update path writes under the running plugin's root",
      "how": "Test asserts no write calls under CLAUDE_PLUGIN_ROOT"
    }
  ],
  "cases": [],
  "concepts": {
    "adds": [
      "release"
    ],
    "budget": 1
  },
  "non_goals": [
    "No in-session reload",
    "No marketplace publishing yet"
  ],
  "records": [
    "session.fingerprint (release)",
    "release rows from CI as ci.result"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate subagent on a different model, using the Verifier brief below.",
  "risks": [],
  "after_landing": [
    "After the first real release, a fresh session's fingerprint shows the new release"
  ]
}
```

## Verifier brief

Run the tests. Read release.yml and confirm the version only rises. Check the update path never writes under the
plugin root. If a real release exists, read the two fingerprint rows that bracket it. Verdict per Expect id.

```json
{
  "id": "fix-reminder-wake",
  "title": "Fire the waiting item's timer when its reminder arrives",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "outcome": "A send_later reminder the host scheduled for a waiting item, arriving in the session as it really does (a scheduled-trigger notification read by ReadNotifications), fires that item's timer through bin/host.js wake with no hand wrapping.",
  "why": "fix-waiting-wake schedules a wake for every asking state, but its verifier found the reminder arrives as a notification, not a <wake> prompt, and bin/host.js keeps only github_webhook notifications. So in a real thread the timer fires only if the session wraps the reminder itself, and C-waiting-does-not-stall holds in the stubbed world but not end to end.",
  "serves": [
    "L-never-idle-on-person"
  ],
  "depends_on": [
    "fix-waiting-wake"
  ],
  "cases": [
    "C-waiting-does-not-stall"
  ]
}
```

Drafted by the s5 gate judgment (`plan/decisions/2026-11-04-s5-parity-gate.md`). What the replan that makes it ready
should settle: the real shape of a scheduled-trigger notification in the ReadNotifications result (capture one; the
fix-waiting-wake evidence in `/mnt/project-files/verify-runs/fix-waiting-wake/evidence/` has the body), how
`wakeTextOf` in `packages/engine/bin/host.js` tells a reminder the host scheduled from any other trigger (the
reminder should carry the item and timer it was scheduled for), and a world proof: a real send_later fire, read by
ReadNotifications, moving a timer row with no wrapping.

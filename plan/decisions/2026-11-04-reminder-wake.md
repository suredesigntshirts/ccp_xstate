# Reminder wake: a trigger_fire notification is a bare wake at the time it fired (2026-11-04)

Item: fix-reminder-wake. Two-way doors, decided by the building thread as the person's stand-in.

## What a reminder really looks like

Captured 2026-11-04 23:10Z in the thread "Fix the reminder wake": a send_later scheduled for one minute, read with
ReadNotifications once it was pending. The session transcript records the tool result as:

```json
{
  "notifications": [
    {
      "notification_id": "8b82ee87-f95a-4dea-9e6a-b179193ab4d6",
      "origin": "trigger_fire",
      "queued_at": "2026-11-04T23:10:35Z",
      "content": "checkBack capture probe for fix-reminder-wake: item probe-1 timer probe-1:3.xstate.after.checkBack (this is a shape capture, nothing to do but record it)\n<system-reminder>This task fired at Wed 2026-11-04 23:10:35 UTC. Treat this as the current date and time — the conversation may have been idle since the last message. Fired by routine \"Capture reminder shape\" (trigger_id: trig_01P2BTg4riV2ELJRB7xEVbyb).</system-reminder>\n<system-reminder>\nThread state: the user last wrote 5h 2m ago. Claude has sent 1 reply since then.\n</system-reminder>",
      "arrived_at": "2026-11-04T23:10:35.720Z"
    }
  ],
  "remaining": 0,
  "read_at": "2026-11-04T23:10:37.043Z"
}
```

So the origin is `trigger_fire` (not `send_later`, which the engine-host forge test already ignores), the time it
fired is `queued_at`, and the content is the message the session wrote plus platform reminders. No `<wake>` envelope.

## Decisions

1. **`wakeTextOf` turns each `trigger_fire` notification into `<wake reason="scheduled" current-time="<queued_at>">`
   with an empty body**, `arrived_at` if `queued_at` is missing. `inputsOfWake` then clamps that time to the host's
   clock and fires the timers due by it, as for any wake.
2. **The content is never read.** The session writes it, and any agent with send_later can write one, so reading it
   would let typed text become GitHub events or taps. A bare wake can only fire timers already due by the host's own
   clock, which any wake may do, so nothing the reminder says needs to be trusted.
3. **The reminder does not have to name its item or timer.** The draft asked how the host tells its own reminder from
   another trigger. It doesn't need to: the host's journal holds which timers are set and when they are due, and a
   routine firing them a little early is impossible (the clamp) while firing them late is the point. The session can
   still name the item in the message for its own reading.

## Why not

- **A hook that runs `bin/host.js wake` on every ReadNotifications.** That is the step from "the session drives the
  host" to "the plugin drives it", a larger change than this gap; GitHub notifications are fed by the session too.
- **Parsing the message for an item and timer id**, to fire only that timer. It adds a trusted format to text an agent
  writes and buys nothing over the clock.

## Residual

The capture is the transcript's record of the tool result. A PostToolUse hook's `tool_response` for a built-in tool
is that same object as far as this project has seen, but no hook capture of ReadNotifications exists. If it differs,
reminders are dropped as today (fails closed); the thread-wake proof feeds the transcript's record.

## Outcome

Built in PR #89 (merged b3fc935). A separate verifier session marked all five Expect lines MET at dfd2a8e
(`verify/fix-reminder-wake/verdict.json`, commit b509e4d); in its own thread a raw send_later reminder, fed unedited
from ReadNotifications to `bin/host.js wake`, fired the checkBack timer with no hand wrapping. No harness release:
`bin/host.js` runs from the repo checkout and is not in what the setup script copies (`RELEASED` in
`scripts/release/release.mjs`), so the release script found nothing to release since harness-v0.1.21.

# probe-plugin-agents-thread goes ready (2026-11-05)

The person re-saved the cloud environment's setup script at 07:15Z. The thread started at 07:16Z for this item shows
`ccp-harness 0.1.24 (harness-v0.1.24): self-check passed (7 of 7 checks)` at SessionStart, its capture journal's
`session.fingerprint` row has release 0.1.24 from `/root/.claude/skills/ccp-harness`, and its Agent tool lists
`ccp-harness:probe-reader`. So the item's wait is over and it goes ready.

Two-way doors decided:

- **Commit extracts, not the whole thread transcript.** The thread's transcript holds its system prompt, memory and
  project context. The evidence a verifier needs is the SessionStart line, the agent listing, the Agent call and its
  result, plus the subagent's own transcript and meta.json, which are small and hold only the probe. The capture
  journal on the shared mount is a second, independent record the verifier reads directly.
- **The verifier repeats the call in its own thread.** A verifier thread now also starts on the newest release, so it
  can run the same Agent call itself. That is a stronger world check than reading the builder's copies.
- **Swap and binding are not re-run.** They are harness code paths that probe-plugin-agents proved on this same
  release's code; nothing about a Projects thread changes them. The item's question is only whether the plugin's agent
  loads and holds in a thread.

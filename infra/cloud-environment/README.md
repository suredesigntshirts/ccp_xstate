# Cloud environment

1. In the v2 project: Project settings, Cloud environment menu, create an environment of its own (not v1's).
2. Click the gear beside it and paste `paste-me.sh` into Setup script, once. Saving rebuilds the container.
3. Allow rules and settings live in `.claude/settings.json` at the repo root. `setup.sh` merges them into
   `~/.claude/settings.json` at each container build. A change reaches threads only after a rebuild (re-save the
   setup script), and only rules placed before a thread starts count (ledger L-rules-before-session).

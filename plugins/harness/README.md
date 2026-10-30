# ccp-harness plugin

The v2 Claude Code plugin (plan item env-bootstrap). Sessions never load this folder: the setup script
(`infra/cloud-environment/setup.sh`) installs a copy of a release at `~/.claude/skills/ccp-harness`, where Claude
Code loads it as `ccp-harness@skills-dir`. Editing this folder changes nothing a running session uses
(ledger L-no-self-modification, L-plugins-load-at-start).

## Releases

A release is a tag `harness-v<x.y.z>` whose `x.y.z` is the version in `.claude-plugin/plugin.json` (and
`package.json`). The setup script installs the newest tag by version; with no tag it installs the clone's HEAD and
says so. The copy carries `release.json`: name, version, tag, commit and its file list. `packages/journal` is bundled
into the copy at `lib/journal`. Making tags on merge is plan item self-update-by-version.

## The gate

The plugin is on every session the environment builds, so every hook does nothing (exit 0, no output, no writes)
unless the project installed the harness: the marker `$CCP_HARNESS_DIR/install.json` exists (default
`/mnt/project-files/harness/install.json`, one read capped at 1 s). `CCP_HARNESS_DISABLED=1` turns every hook off
even where the marker exists. Both are defined only in `scripts/host.mjs`.

**Install** with the `install` skill when the person asks: it runs `scripts/install.mjs`, which makes the journal root
`$CCP_HARNESS_DIR/journal/sessions/` and writes the marker. It takes effect from the next session.

## SessionStart

`scripts/session-start.mjs`, timeout 5 s, its own watchdog at 4 s. In an installed project it appends two rows to
`journal/sessions/<session>.jsonl` (`docs/journal.md`, "Session rows"):

- `session.fingerprint`: Claude Code version, plugin release and commit, where the copy runs from, the newest
  release on origin, the allow rules (count and hash), the subagent depth, other skills-dir plugins.
- `session.selfcheck`: one result per check, and the line below.

Then it tells the session one line: `ccp-harness 0.1.0 (harness-v0.1.0): self-check passed (6 of 6 checks).`, or
`... self-check FAILED.` followed by one plain sentence per failed check. The checks (`scripts/selfcheck.mjs`):

| Check | Fails when |
|---|---|
| `settings` | `~/.claude/settings.json` is missing or unreadable: the setup script didn't run in this container |
| `rules` | an `autoMode.allow` rule in the repo's `.claude/settings.json` (`$CCP_REPO`, default `/home/user/ccp_xstate`) isn't in `~/.claude/settings.json` |
| `depth` | `env.CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` in `~/.claude/settings.json` isn't `3` |
| `copy` | the plugin runs from somewhere other than an installed copy (no `release.json`, a link, or inside the repo) |
| `release` | a newer `harness-v*` tag is on origin (`git ls-remote`, 2 s cap; unreachable is `unknown`, not a failure) |
| `journal` | the rows could not be appended |

The check only reports. It never writes settings: a session placing its own rules is what ledger
L-rules-before-session warns of (plan/decisions/2026-10-30-setup-script-vs-sessionstart.md). The remedy for a failed
check is a new thread, which gets a new container where the setup script runs.

## Tests

`test/` here and `test/setup.test.mjs` at the root run the real setup script into temp HOMEs and the hook as Claude
Code runs it. The tests install the working tree as a commit (`git stash create`, else HEAD) through `CCP_SETUP_REF`, so an
uncommitted change is what they test.

#!/usr/bin/env bash
# The whole run, from a fresh world: brief, blocked build, clear + retry, build, CI, verify, CI-change card, merge.
set -euo pipefail
cd "$(dirname "$0")"
H=..
rm -rf "$H/journal" "$H/install.json" "${TRIAL_DIR:-/home/user/trial-blocked-retry}"
node drive.mjs init
node drive.mjs agent        # 0.brief
node drive.mjs agent        # 1.build: blocked by the refused push
node drive.mjs clear        # the stand-in grants the scope
TRIAL_BY="${TRIAL_BY:-stand-in}" node drive.mjs tap retry
node drive.mjs agent        # the retried build
node drive.mjs agent        # verify; the CI-change card is tapped and the item merges

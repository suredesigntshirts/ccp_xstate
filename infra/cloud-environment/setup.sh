#!/bin/bash
# ccp_xstate cloud setup. Run by paste-me.sh at each container build, before Claude Code starts.
# Merges the repo's .claude/settings.json into ~/.claude/settings.json: objects merge, the repo wins on
# plain values, and lists (such as autoMode.allow) are unioned. Settings live in the repo, never here
# (ledger L-setup-script-stub, L-rules-before-session). Logs setting names only, never values.
# Log: /tmp/ccp-xstate-setup.log. Always exits 0.
log="${CCP_SETUP_LOG:-/tmp/ccp-xstate-setup.log}"
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
{
  echo "== setup start $(date -u +%Y-%m-%dT%H:%M:%SZ) repo $(git -C "$repo" log --oneline -1 2>&1)"
  mkdir -p "$HOME/.claude"
  python3 - "$repo/.claude/settings.json" "$HOME/.claude/settings.json" <<'PY'
import json, os, sys
src, dst = sys.argv[1], sys.argv[2]
repo = json.load(open(src))
user = json.load(open(dst)) if os.path.exists(dst) else {}
def merge(a, b):
    for k, v in b.items():
        if isinstance(v, dict) and isinstance(a.get(k), dict): merge(a[k], v)
        elif isinstance(v, list) and isinstance(a.get(k), list): a[k] += [x for x in v if x not in a[k]]
        else: a[k] = v
    return a
merged = merge(user, repo)
json.dump(merged, open(dst, 'w'), indent=2)
print('settings merged; keys:', ' '.join(sorted(repo)), '; autoMode.allow rules:', len(merged.get('autoMode', {}).get('allow', [])))
PY
  echo "== setup end $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$log" 2>&1
exit 0

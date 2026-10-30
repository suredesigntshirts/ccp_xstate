#!/bin/bash
# ccp_xstate cloud setup. Run by paste-me.sh at each container build, before Claude Code starts. Plan item
# env-bootstrap holds the reasoning (ledger L-setup-script-stub, L-rules-before-session, L-no-self-modification).
# 1. Merges the repo's .claude/settings.json into ~/.claude/settings.json: objects merge, the repo wins on plain
#    values, and lists (such as autoMode.allow) are unioned. That is where the allow rules and the subagent depth
#    (env CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=3) come from. Settings live in the repo, never here.
# 2. Installs the ccp-harness plugin as a copy of the newest release (tag harness-v<x.y.z>), or of the clone's HEAD
#    when there is no release yet, at ~/.claude/skills/ccp-harness, where Claude Code loads it as a plugin. It is
#    extracted from git, never linked to the working tree, so editing plugins/ changes nothing a session runs.
#    packages/journal is bundled at lib/journal, and release.json says what the copy was built from.
# 3. Logs the names of the environment variables, never their values.
# Running it again gives the same ~/.claude files. Log: $CCP_SETUP_LOG (default /tmp/ccp-xstate-setup.log).
# Tests only: CCP_SETUP_FETCH=0 skips fetching release tags from origin, and CCP_SETUP_REF installs that ref
# instead of the newest release (the tests install HEAD, so they test the code they sit beside). Always exits 0.
log="${CCP_SETUP_LOG:-/tmp/ccp-xstate-setup.log}"
repo=$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)
plugin=ccp-harness
dest="$HOME/.claude/skills/$plugin"
{
  echo "== setup start $(date -u +%Y-%m-%dT%H:%M:%SZ) repo $(git -C "$repo" log --oneline -1 2>&1)"
  mkdir -p "$HOME/.claude/skills"

  # 1. Settings.
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
with open(dst, 'w') as f:
    json.dump(merged, f, indent=2)
    f.write('\n')
print('settings merged; keys:', ' '.join(sorted(repo)), '; env keys:', ' '.join(sorted(merged.get('env', {}))),
      '; autoMode.allow rules:', len(merged.get('autoMode', {}).get('allow', [])))
PY

  # 2. The plugin, as a copy of a release.
  if [ "${CCP_SETUP_FETCH:-1}" != 0 ]; then
    timeout 20 git -C "$repo" fetch -q origin 'refs/tags/harness-v*:refs/tags/harness-v*' 2>&1 || echo "release tags not fetched; using the tags the clone has"
  fi
  tag=$(git -C "$repo" tag -l 'harness-v*' --sort=-v:refname | head -1)
  ref="${tag:-HEAD}"
  if [ -n "$CCP_SETUP_REF" ]; then
    ref="$CCP_SETUP_REF"; tag=""
    case "$ref" in harness-v*) tag="$ref" ;; esac
  fi
  commit=$(git -C "$repo" rev-parse "$ref^{commit}" 2>/dev/null)
  work=$(mktemp -d)
  if [ -n "$commit" ] && git -C "$repo" archive "$commit" plugins/harness packages/journal \
      ':(exclude)plugins/harness/test' ':(exclude)packages/journal/test' | tar -x -C "$work"; then
    mkdir -p "$work/out/lib"
    cp -a "$work/plugins/harness/." "$work/out/"
    cp -a "$work/packages/journal" "$work/out/lib/journal"
    python3 - "$work/out" "$tag" "$commit" <<'PY'
import json, os, sys
root, tag, commit = sys.argv[1], sys.argv[2] or None, sys.argv[3]
files = sorted(os.path.relpath(os.path.join(d, f), root) for d, _, fs in os.walk(root) for f in fs)
manifest = json.load(open(os.path.join(root, '.claude-plugin', 'plugin.json')))
with open(os.path.join(root, 'release.json'), 'w') as f:
    json.dump({'name': manifest['name'], 'version': manifest['version'], 'tag': tag, 'commit': commit, 'files': files}, f, indent=2)
    f.write('\n')
print('plugin', manifest['name'], manifest['version'], 'from', tag or 'HEAD (no release tag yet)', commit[:12], '-', len(files), 'files')
PY
    rm -rf "$dest.old"
    [ -e "$dest" ] || [ -L "$dest" ] && mv "$dest" "$dest.old"
    mv "$work/out" "$dest" && rm -rf "$dest.old" && echo "installed $dest"
  else
    echo "plugin not installed: could not extract plugins/harness at ${ref}"
  fi
  rm -rf "$work"

  # 3. Environment variable names only.
  echo "env names: $(compgen -e | sort | tr '\n' ' ')"
  echo "== setup end $(date -u +%Y-%m-%dT%H:%M:%SZ)"
} >> "$log" 2>&1
exit 0

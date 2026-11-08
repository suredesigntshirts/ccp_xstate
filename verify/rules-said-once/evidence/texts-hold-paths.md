# texts-hold-paths

Command: `node --test verify/rules-said-once/texts-hold-paths.test.mjs` at d6df5a7. A token in backticks is a path when it has a "/" or ends in .md/.mjs/.js/.json/.yml, and a repo path when its first segment is a top-level repo entry; a token holding < or a glob sign is a pattern; `.claude/...` (Claude Code's config location in any project) is left out. plan/README.md's bare names are read under plan/. Against main a27aca3, before this build (RSO_REPO=<that clone>) the same file fails 3 of 3: docs/selfcheck.md `scripts/install.mjs`, docs/tournaments.md `.github/workflows/tournament.yml`, and 61 + 129 + 100 = 290 lines.

```
ok 1 - every repo path the texts name in backticks exists at the head
ok 2 - plan/README.md's bare file names exist under plan/
ok 3 - CLAUDE.md has fewer than 100 lines; CLAUDE.md, plan/README.md and docs/gates.md fewer than 230 together
# CLAUDE.md 54, plan/README.md 95, docs/gates.md 78; total 227
# tests 3
# pass 3
# fail 0
```

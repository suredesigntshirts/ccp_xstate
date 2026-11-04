# vendor/

Third-party code copied in verbatim. Nothing here is a workspace, a harness library or covered by `npm test`.
Change a copy only by re-copying from its source, and update its row.

| Folder | Source | Commit | Copied | Left out |
|---|---|---|---|---|
| `documentation-downloader/` | [suredesigntshirts/skill-documentation-downloader](https://github.com/suredesigntshirts/skill-documentation-downloader), PR #2 branch `claude/awesome-pasteur-mbuc23` (v2.0.0) | `e011667601fb9396c7c65c81b47ffa53870c6ce5` | 2026-11-04 | `eval/` (4 MB eval corpus), `.github/` |

## documentation-downloader

`infra/cloud-environment/setup.sh` (step 2b) copies it to `~/.claude/skills/documentation-downloader` and runs
`npm ci` there, so every new container's sessions get the `documentation-downloader` skill. It uses the container's
preinstalled Chromium; no browser download.

To refresh: `git -C <clone> archive <sha> | tar -x -C vendor/documentation-downloader --exclude=eval --exclude=.github`
after emptying the folder, then update the commit above.

Known limit: the skill's atomic writes use hard links, which `/mnt/project-files` refuses (ENOTSUP). Run it from a
local folder (the repo, or a scratch dir) and copy results to the shared folder.

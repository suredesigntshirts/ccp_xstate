# Verifying an item

How a plan verifier writes and runs its tests: the techniques the rules in `docs/gates.md` and `docs/layout.md`
leave open. Container traps that any thread meets are in `docs/traps.md`. This is a notes file: any PR may add or
correct an entry with no `Item:` line (`docs/gates.md`), so a verifier writes a technique here in the PR where it
learnt it, never only in project memory.

## A reader without memory

A fresh `claude -p` reader started from a thread loads the thread's project memory and the container's CLAUDE.md
folders, so it can answer from them instead of the repo. A reader that must answer from the repo alone runs in a
clean clone with an empty `HOME` and memory off:
`env -u CLAUDE_CODE_REMOTE_SESSION_ID -u CLAUDE_MEMORY_STORES -u CLAUDE_COWORK_MEMORY_PATH_OVERRIDE
-u CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD -u CLAUDE_ADDITIONAL_DIRECTORIES CLAUDE_CODE_DISABLE_AUTO_MEMORY=1
HOME=<empty dir> claude -p ... < /dev/null`.

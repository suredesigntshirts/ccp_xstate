# probe-plugin-agents: `listed` reworded to the path a thread can reach (2026-11-05)

The verifier of PR #109 found `listed` NOT MET only on its wording: it asked for "a fresh cloud thread on the release
that ships the agent". No such thread can exist yet: new threads resume a cached container holding harness 0.1.17
and skip `setup.sh` (`plan/decisions/waiting-for-person.md`), and the release is made only after the merge.

Both builder and verifier ran the same path instead: `setup.sh` installing the build commit into a fresh `HOME`, then
`claude -p` with no `--plugin-dir`, which loads `ccp-harness@skills-dir` at session start in a cloud container. That
path is what `listed` now names. The Projects-thread step moves to draft item `probe-plugin-agents-thread`, picked up
by the first thread that starts on a release shipping the agent. Two-way door: the item's other lines are unchanged.

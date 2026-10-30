# self-update-by-version: how a release is made and how a session learns of it

**Date:** 2026-10-30, by the self-update-by-version build thread, on the person's standing instruction to decide
two-way doors and not wait. All of these are workflow, script or plugin code and can be changed by a later PR.

1. **The tag is the version; no bump commit.** `.github/workflows/release.yml` tags the pushed sha
   `harness-v<x.y.z>` and commits nothing. A bot commit to `main` would race thread merges and break once `main` is
   protected (waiting-for-person.md). `setup.sh` writes the tag's version into the installed copy's `plugin.json`,
   so the fingerprint and the journal's `release` field show the release. The repo's `plugin.json` version is the
   floor: the next release is the newest tag's patch + 1, or that version when it is higher (a minor or major bump
   is made by editing it in a PR). This replaces env-bootstrap decision 2's "matching plugin.json".
2. **What counts as a plugin change:** anything `setup.sh` copies into a session, so `plugins/harness/` and
   `packages/journal/`, minus their `test/` folders. A docs-only or test-only merge makes no release.
3. **The base is the newest release tag**, not the push's before sha, so a change whose release run failed is
   released by the next push. With no tag yet, the push's before sha is the base; the first plugin merge after this
   item lands is released as `harness-v0.1.0` (the manifest's version), clearing the "no release tag" line in
   waiting-for-person.md without a person.
4. **The CI record is a `ci.result` row in the tag's annotation** (and the run's summary), validated against the
   journal schema. Actions can't write the project's journal mount; obs items can read rows from tags.
5. **The behind-notice reminds, it doesn't update.** At most once per 30 minutes per session, and every time that
   window passes while a newer release is out. v1 fast-forwarded its checkout from the hook; v2 can't, because
   the running copy is the plugin the session runs (L-no-self-modification). Its timestamp lives in
   `$CCP_HARNESS_STATE` (default `$TMPDIR/ccp-harness`), never under the plugin root.
6. **The clone fast-forward is v1's rule set, in `setup.sh`:** tracked files clean, and on a branch tracking
   `origin/main` or detached at an ancestor of it. Thread containers check out a `claude/...` branch, so there it
   logs why it skipped; it matters for clones left on `main`.
7. **`setup.sh` won't replace the running plugin.** When `CLAUDE_PID` names a process whose HOME is this HOME (a
   session running the script on itself), it leaves `~/.claude/skills/ccp-harness` alone and says so.

# traps-answered

Head: d9e142f7dc7235d4c964a5c364bdf942afc76afb (tried first at b70fe62; d9e142f only merges main, which changes
plan/items/rules-said-once.md, so docs/traps.md and CLAUDE.md are byte-identical).

## The fresh reader

A clean clone of the head with `origin` removed, `npm ci` done in the source clone. Run from its root:

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "$(cat prompt.txt)"
```

Prompt (the Verifier brief's, verbatim):

> Using only this repository, answer: (1) in this cloud container, how do I make a commit whose sha I will quote as evidence? (2) a test fails saying a commit is a shallow boundary: what do I do? (3) how do I run claude -p from inside a thread's session so its rows are not filed under the thread? (4) may I run npm test in a checkout and its git worktree at the same time?

Answer, verbatim:

All four answers come from `docs/traps.md`.

1. **Committing in the container.** `/root/.gitconfig` turns on SSH-key signing, so every commit gets a signature and a different sha on each run. Evidence shas built in a temp repo then can't be matched elsewhere. Commit without the container's config:
   `GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false -c user.name=t -c user.email=t@example.com commit ...`

2. **"Shallow boundary" test failure.** The container clone is shallow, so a test that reads history (a done item's first commit, a merge base) can't find it. Run `git fetch --unshallow origin` once, then rerun the test. CI checks out full history.

3. **`claude -p` from a thread.** It inherits `CLAUDE_CODE_REMOTE_SESSION_ID`, so its rows and commits are filed under the thread's session. To make it count as its own session, start it with `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p ...`.

4. **`npm test` in a checkout and its worktree.** No. The two runs interfere, so run one and then the other. The full suite takes minutes. A builder runs the tests near its change locally and leaves the full suite to `ci`.

## What I tried in the container

### (1) Commit whose sha is quoted

The container's `/root/.gitconfig` sets `commit.gpgsign = true`, `gpg.format = ssh`, a signing key and program.
In a temp repo:

- `git commit -q -m signed`; `git cat-file -p HEAD | grep -c gpgsig` -> `1`.
- `GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false -c user.name=t -c user.email=t@example.com commit -q -m unsigned`;
  same check -> `0`.
- Same content, `GIT_AUTHOR_DATE=GIT_COMMITTER_DATE=2026-01-01T00:00:00Z`, two fresh repos each:
  with the answer's command both give `5172a22764e03fcf6f23954dbc0f20a1873a1167`, a sha any machine reproduces (no
  signature, fixed identity); with the container's config both give `c977e772dfe76ac61c66329ba5732478863f9c65`, which
  carries a signature only this container's key makes, so CI cannot reach it.

Works. (The ed25519 signature is deterministic here, so "different shas on every run" holds only when the dates move;
the part that matters, that a signed sha cannot be made elsewhere, holds.)

### (2) "shallow boundary"

`/home/user/ccp_xstate` (the thread's container clone, 5 shallow roots) copied to a temp dir, at d9e142f's parent b70fe62:

- `node --test verify/fix-budget-rule/backfill-true.test.mjs` -> `# pass 3 / # fail 1`, error
  `'fix-agent-finish-ms: first done commit is a shallow boundary; fetch more history'`.
- `git fetch --unshallow origin` -> `git rev-parse --is-shallow-repository` = `false`.
- Rerun -> `# pass 4 / # fail 0`.

Works.

### (3) claude -p from a thread

From a clean clone, prompt "Run exactly this shell command and reply with only its output, or the word UNSET if it
prints nothing: printenv CLAUDE_CODE_REMOTE_SESSION_ID", `--allowedTools Bash`, stdin `/dev/null`:

- `claude -p ...` -> `cse_01KfkB5EPzyxSqpfkLCjGeTp` (this thread's session).
- `env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p ...` -> `UNSET`.
- The harness files rows by `sessionName()` in `plugins/harness/scripts/host.mjs`:
  with the thread's environment it gives `https://claude.ai/code/session_01KfkB5EPzyxSqpfkLCjGeTp`; under
  `env -u CLAUDE_CODE_REMOTE_SESSION_ID` it gives the local `session_id` (`local-x` in the call).

Works.

### (4) npm test in a checkout and its worktree at once

Graded against the repo: `docs/traps.md`, "One suite at a time", says no, run one then the other. The answer says the
same. Not tried (the trap is that it breaks both runs).

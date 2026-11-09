# notes-pass

Command: `node --test verify/memory-boundary/notes-pass.test.mjs` at 40dc78dd706dc13ec7a6a08f5a4ba5e52b1e30cf (7 pass, 0 fail).

Inputs: per case a temp repo (`GIT_CONFIG_GLOBAL=/dev/null`, signing off) whose base holds `plan/items/x.md` (ready), `docs/traps.md`, `docs/gates.md`, `docs/layout.md`, `CLAUDE.md` and `scripts/gates/lib.mjs`; one PR commit on top; then the checkout's `scripts/gates/pr-gate.mjs verdict` with `BASE_SHA` the base, `HEAD_SHA` the commit, `PR_BODY` with no `Item:` line (and once empty), `PR_LABELS=[]`.

Excerpt: exit 0 and "verdict gate passed" for: docs/traps.md changed; docs/verifying.md added; docs/traps.md with plan/decisions/d.md; docs/verifying.md with plan/items/y.md and plan/ledger/l.md; both notes files with plan/; docs/traps.md deleted; docs/traps.md with an empty body.

Bite: at main's 38573a0d the same gate refuses every one of these ("changes files outside plan/ but names no item").

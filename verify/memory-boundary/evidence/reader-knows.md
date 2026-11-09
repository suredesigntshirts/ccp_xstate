# reader-knows

Command: `claude -p "$(cat prompt)" < /dev/null` in a clean clone of 40dc78dd706dc13ec7a6a08f5a4ba5e52b1e30cf (origin removed, `npm ci`), with `env -u CLAUDE_CODE_REMOTE_SESSION_ID -u CLAUDE_MEMORY_STORES -u CLAUDE_COWORK_MEMORY_PATH_OVERRIDE -u CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD -u CLAUDE_ADDITIONAL_DIRECTORIES CLAUDE_CODE_DISABLE_AUTO_MEMORY=1 HOME=<empty dir>`. Claude Code 2.1.319 (Claude Code). `node --test verify/memory-boundary/reader-knows.test.mjs` regrades the answer below.

Control: the same prompt in a clean clone of main's 38573a0d2f8be19c1eae60df4f25e3c5efbf6ded, same environment, sent item 2 to `verify/<item>/` and the verdict's observations ("Repo docs don't clearly cover a standing, reusable technique"), and said it "never opened anything in the repo about project memory".

## Prompt

You are a Claude thread working in this repository (read it to answer). During your work you met four things, and you want a later thread or coordinator to benefit from each:

1. A container trap: in the cloud container, a test that shells out to `git commit` failed because commits there are signed.
2. A verifier technique: a way to grade a fresh `claude -p` reader's answer so the grade can be rerun as a test.
3. A defect: the inspector shows a stage's finish time wrong; you are not fixing it now.
4. The number of the PR you just merged, #301.

For each one, say where it should be recorded: a file in the repository (which one), project memory, somewhere else, or nowhere. Give a one-line reason and cite the repository file that says so. Answer as a numbered list.

## Answer

1. **Container trap (commits are signed): `docs/traps.md`.** Add it in the PR where you met it, with no `Item:` line. `docs/traps.md` already has an entry, "The container signs commits", which gives the `GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false …` workaround. So add to that entry if your case is new, and don't add a duplicate. Don't put it only in project memory. `CLAUDE.md` says "A trap goes in `docs/traps.md`", and the header of `docs/traps.md` says a thread writes a trap there "never only in project memory".

2. **Verifier technique (grading a fresh `claude -p` reader's answer as a rerunnable test): `docs/verifying.md`.** Add it in the PR that learnt it, with no `Item:` line. The section "A reader without memory" there already covers running the reader in a clean clone with an empty `HOME` and memory off. Put the grading technique next to it. `CLAUDE.md` says "a test technique in `docs/verifying.md`", and the header of `docs/verifying.md` says to write it there "never only in project memory".

3. **Inspector finish-time defect: a plan item in `plan/items/`.** Write it as a new item file, and run `node plan/check.mjs` after. Don't fix it now, and don't put it in memory, in `docs/traps.md` or in a code comment. `CLAUDE.md` says "a defect in a plan item", and `plan/README.md` says "A change is one file plus edges". The inspector's own documentation is `docs/inspector.md`, but the defect still belongs in the plan item.

4. **PR number #301: nowhere.** Don't put it in project memory, a doc, a comment or a plan item. The merge commit and the PR itself already record it. `CLAUDE.md` says, "Memory holds directives and state, not learnings … never a PR number or sha". It also says item ids, lanes and rounds go in commits and PRs, not in code comments or READMEs.

I only grepped `plan/README.md` and `docs/gates.md` for how defect items are written, and I didn't read either file in full. Before you write the item for #3, check `plan/README.md`, "How an item moves", for the exact item format.

## Grading

Each numbered answer must name its home and must not send it to project memory (a sentence saying "project memory", "in memory" or "to memory" must also say don't, not, never or only):

1. container trap: `docs/traps.md`. Met, citing CLAUDE.md "A trap goes in `docs/traps.md`" and the traps.md header.
2. verifier technique: `docs/verifying.md`. Met, citing CLAUDE.md "a test technique in `docs/verifying.md`".
3. defect: a plan item. Met, "a plan item in `plan/items/`", citing CLAUDE.md "a defect in a plan item".
4. merged PR's number: nowhere. Met, citing CLAUDE.md "never a PR number or sha".

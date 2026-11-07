```json
{
  "id": "harness-glossary",
  "title": "Give each harness concept one word per context",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "docs/language.md lists the plan, engine, platform and observation terms, one line each, naming the code that carries each term. In the engine, brief means only the brief stage and the per-role briefs it returns: a run's rendered prompt is prompt.md, its hash promptHash, and its row prompt.stored. The capture hook writes agent.prompt and agent.final instead of brief.stored and result.stored. The journal is at v2, with an upcaster that maps v1 rows to those kinds and fields on read, so every committed v1 journal reads as before. CLAUDE.md tells builders to use the glossary's terms and to add a line there before introducing a new one. No model-facing text changes.",
  "why": "brief, brief.stored and result.stored each carry two or three meanings today: brief is a model stage, every run's rendered prompt (brief.md, briefHash) and the per-role briefs; brief.stored is written by the engine for a prompt, by the engine for a returned brief, and by the capture hook for an Agent prompt; result.stored by the engine's accept and by the capture hook. The inspector already carries a table translating between them (scripts/inspector/export.mjs, the capture-row notes), which is DDD's translator bottleneck, and every agent session reads the code in these words. Research plan/research/design-books-cleanup.md, finding 1.",
  "serves": [
    "L-record-route-at-write",
    "L-version-event-schema",
    "L-pages-current-on-demand"
  ],
  "depends_on": [
    "run-names-one-module"
  ],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 1: the collision table (brief, brief.stored, result.stored, actor, stage, prompt vs brief) with file and line, and the change"
    },
    {
      "ref": "packages/engine/src/actors.js",
      "what": "prepare writes brief.md and a brief.stored row with contextHash (about lines 236-251); spawn reads brief.md (274); agent.spawn payload briefHash (315); accept writes result.stored and, for the brief stage, one brief.stored per role (579-590)"
    },
    {
      "ref": "packages/engine/src/names.js",
      "what": "The one module every process loads for run paths; the prompt file's name joins it"
    },
    {
      "ref": "plugins/harness/scripts/capture-rows.mjs",
      "what": "briefOf and the capture's brief.stored (about 223-250), result.stored at SubagentStop (354), agent.spawn briefHash (236)"
    },
    {
      "ref": "packages/journal/src/index.js, packages/journal/src/kinds.js",
      "what": "VERSION 1, empty UPCASTERS, upcast() and readFile(); KINDS"
    },
    {
      "ref": "packages/journal/src/derive/stalls.js",
      "what": "Counts prepared runs by the engine's brief.stored rows"
    },
    {
      "ref": "scripts/inspector/export.mjs",
      "what": "Reads rows raw (readRows), reads brief.md, and holds the capture-row translation notes (about 744-763, 1024-1035)"
    },
    {
      "ref": "scripts/bench/lib.mjs, scripts/bench/run.mjs, scripts/bench/score.mjs",
      "what": "Read a run's brief.md; bench/brief/runs/ holds committed v1 run folders"
    },
    {
      "ref": "docs/journal.md, docs/prompts.md, docs/inspector.md, plugins/harness/README.md, packages/engine/README.md",
      "what": "Where the kinds, run-folder files and payloads are documented"
    }
  ],
  "outputs": [
    {
      "ref": "docs/language.md",
      "what": "The glossary in four contexts (plan, engine, platform, observation). One line per term: what it means in that context and the code, file or row kind that carries it. Covers at least item, plan stage, model stage, run, actor, host effect, workflow, brief, prompt, context, result, return, card, journal, row, kind, session, agent, thread, run folder; says which word to use where two contexts meet (model stage versus plan stage)"
    },
    {
      "ref": "packages/engine/src/names.js",
      "what": "promptFile(root, run): the run's prompt.md, or brief.md when only that exists (a folder written before journal v2); the old name appears only here"
    },
    {
      "ref": "packages/engine/src/actors.js",
      "what": "prepare writes prompt.md and a prompt.stored row (same payload as today's prompt row), run.promptHash; spawn reads promptFile; agent.spawn payload promptHash; accept's per-role rows stay brief.stored and are the only brief.stored rows the engine writes"
    },
    {
      "ref": "plugins/harness/scripts/capture-rows.mjs",
      "what": "agent.prompt (PostToolUse of Agent) and agent.final (SubagentStop) rows with today's payloads; agent.spawn payload promptHash"
    },
    {
      "ref": "packages/journal/src/index.js, kinds.js",
      "what": "VERSION 2; UPCASTERS[1] maps a v1 brief.stored with contextHash to prompt.stored, a v1 brief.stored with no run to agent.prompt, a v1 result.stored with no run to agent.final, and agent.spawn payload briefHash to promptHash, and leaves every other row as it was; KINDS gains prompt.stored, agent.prompt and agent.final"
    },
    {
      "ref": "packages/journal/src/derive/stalls.js, scripts/inspector/export.mjs, scripts/bench/",
      "what": "Read prompt.stored and agent.* kinds; the inspector reads rows through the journal's upcast and run prompts through promptFile, and drops its capture-row translation notes; bench reads through promptFile"
    },
    {
      "ref": "docs/journal.md, docs/prompts.md, docs/inspector.md, the two READMEs",
      "what": "The new names, and the v1 to v2 upcaster under Versions"
    },
    {
      "ref": "CLAUDE.md",
      "what": "docs/language.md in the layout table, and one principle line: use the glossary's terms, and add a line there before introducing a new one"
    },
    {
      "ref": "tests under packages/, plugins/, scripts/ and verify/",
      "what": "Changed only for the renames this item names: brief.md to prompt.md, the prompt's brief.stored to prompt.stored, capture brief.stored and result.stored to agent.prompt and agent.final, briefHash to promptHash, row v 1 to 2. Committed evidence and fixtures are not rewritten"
    },
    {
      "ref": "packages/journal/test/, packages/engine/test/",
      "what": "The builder's tests of the upcaster on each v1 row shape and of promptFile's fallback"
    }
  ],
  "expect": [
    {
      "id": "glossary-real",
      "check": "docs/language.md has the four context sections and a line for each term the outputs list, and every file path, export or row kind a line names exists at the head (a kind is in KINDS, an export is exported)",
      "how": "The verifier's own test parsing docs/language.md and resolving each code reference",
      "proof": "verifier"
    },
    {
      "id": "brief-one-meaning",
      "check": "At the head, grep -rnE 'brief\\.md|briefHash|briefOf' over packages/engine/src, packages/journal/src, plugins/harness/scripts, scripts/inspector and scripts/bench, excluding test folders and vendor/, finds only names.js's fallback line and the v1 upcaster; and the only code that writes a brief.stored row is accept's per-role loop for the brief stage",
      "how": "The verifier's grep, and a grep for brief.stored writers",
      "proof": "verifier"
    },
    {
      "id": "capture-own-kinds",
      "check": "A capture hook run at the head over a recorded Agent call and SubagentStop writes agent.prompt and agent.final rows with the payloads main's brief.stored and result.stored rows had, and no brief.stored or result.stored row; capture-rows.mjs holds neither kind",
      "how": "The verifier's own test driving plugins/harness/scripts/capture.mjs with hook inputs, at main and at the head",
      "proof": "verifier"
    },
    {
      "id": "prompt-unchanged",
      "check": "For the same workflow, item and input, the engine at the head writes prompt.md byte-identical to the brief.md main writes, with the same hash in the prompt.stored row as in main's brief.stored row; no brief.md is written; spawn hands out those bytes; and a run folder holding only brief.md (prepared by main) still spawns with its bytes",
      "how": "The verifier's own test preparing a run at both shas from one journal root layout",
      "proof": "verifier"
    },
    {
      "id": "v1-reads",
      "check": "readFile at the head over committed v1 journals (verify/engine-toy-run/evidence, verify/fix-agent-finish-ms/evidence/real, and one bench/brief/runs item) reports no bad rows and yields the mapped kinds and promptHash; derive.js stalls gives the same prepared and blocked counts there as at main; the inspector's export of a committed v1 journal shows each model run's prompt text equal to its brief.md, with every hash check ok as at main",
      "how": "The verifier's own test running readFile, derive.js and scripts/inspector/export.mjs at both shas",
      "proof": "verifier"
    },
    {
      "id": "no-translation",
      "check": "scripts/inspector/export.mjs no longer holds a table or comment saying a capture row is not a harness accept or a host prompt; it tells capture rows from engine rows by kind alone",
      "how": "The verifier reads export.mjs and greps for the old notes",
      "proof": "verifier"
    },
    {
      "id": "claude-md",
      "check": "CLAUDE.md names docs/language.md and has the line telling builders to use its terms and add one before introducing a new term, and stays under 100 lines with every path it names real",
      "how": "The verifier reads CLAUDE.md and runs test/ (the CLAUDE.md path check)",
      "proof": "verifier"
    },
    {
      "id": "behaviour-unchanged",
      "check": "Every test that passes on main passes at the head, and the test-file diff changes only the renames the outputs name, plus the builder's new tests",
      "how": "npm test at both shas, and the verifier's reading of the test diff",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The check runs on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [
      "brief as a run's prompt (brief.md, briefHash, the prompt's brief.stored row)",
      "capture rows sharing brief.stored and result.stored with the engine",
      "the inspector's translation notes between those meanings"
    ],
    "budget": 0
  },
  "non_goals": [
    "No model-facing text change: prompts, the catalogue and stage files read the same (prompt-unchanged checks it)",
    "No rename of actor, actors.mjs, stage or the brief stage; the glossary says which word to use where, and a later item may rename (model stage to step)",
    "The engine still knows the brief stage by its actor name in accept; stage-contract-declares-rules moves that",
    "Committed journals, run folders, bench runs and verify evidence are not rewritten; v1 rows are upcast on read",
    "The Harness Observe page reads none of the renamed kinds or fields, so observe.html is not rebuilt; if a bundled file does change, the build republishes it (verify/obs-page/live.test.mjs pins it)"
  ],
  "records": [
    "prompt.stored, agent.prompt and agent.final rows at journal v2, replacing the prompt and capture uses of brief.stored and result.stored"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1200000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "A session on an older release reads v2 rows as bad (newer v); releases ship together and older writers are already refused on a file with newer rows, so only an old offline reader is affected, and it says why",
    "An in-flight run prepared by an older release has only brief.md; promptFile falls back to it, which prompt-unchanged checks",
    "The inspector loads an engine checkout older than promptFile; it falls back to the repo's own names.js, as it does for the other names"
  ]
}
```

## What this is

Finding 1 of `plan/research/design-books-cleanup.md`. In DDD a ubiquitous language is scoped to a bounded context:
within it each word means one thing and each thing has one word, and a change of word is a change of model that flows
to code, tests and docs. The harness has four contexts that meet in the same files: the plan (items, plan stages
s0-s6, verdicts), the engine (workflows, model stages, runs, host effects), the platform (Claude Code sessions,
subagents, hooks, Hearth threads and cards) and observation (journal rows, kinds, the inspector and Observe pages).

The glossary comes first and is the reference; the renames are the ones that pay now. `brief` keeps its stage
meaning: the brief stage (`workflows/quick-fix/brief.md` and its siblings are that stage's file) and the per-role
briefs it returns, stored as `brief.stored`. A run's rendered prompt becomes `prompt.md` and `prompt.stored`. The
capture hook is a different writer with a different meaning (`L-record-route-at-write`), so its rows get their own
kinds, and the journal moves to v2 with its first upcaster (`L-version-event-schema`), so old journals need no
reader to sniff payload shapes. `item` and `run` stay: both already mean one thing per context. `actor` and `stage`
are documented, not renamed: the glossary says *model stage* wherever *stage* could be read as a plan stage.

The decision record is `plan/decisions/2026-11-07-harness-glossary.md`.

## Done

Built in PR #166 (merged 48777da). A separate session verified it at 4458b03: all nine Expect lines MET. Released
as harness-v0.1.36, tagged by release.yml on the merge.

The build touched more than the inputs named:
- The stage-contract trial drivers under `tournaments/2026-11-04-stage-contract/trials/*/driver/drive.mjs` also read a
  run's prompt file, so they read `prompt.md` now.
- The inspector shows a row the upcaster changed as the file holds it (a non-enumerable `written`), so a v1 journal
  renders as it did on main.
- Done verify suites that compare against recorded main evidence upcast main's rows first. Evidence that drops hashes
  tells a v1 prompt row by its role equalling its actor.

The verifier checked that no committed journal holds a v1 engine prompt row without `contextHash`. The upcaster would
leave such a row as `brief.stored`.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Keep a second clone at its base on main. Without
reading the builder's tests, write your own under `verify/harness-glossary/`:

- **glossary-real:** parse docs/language.md; check the four sections and the listed terms; resolve every path (exists),
  export (imported module has it) and kind (in KINDS) each line names.
- **brief-one-meaning:** run the grep in the Expect line and show only the two allowed places match; grep every
  `brief.stored` writer.
- **capture-own-kinds:** drive `plugins/harness/scripts/capture.mjs` with a recorded PostToolUse of Agent and a
  SubagentStop (plugins/harness/test or verify/obs-live-capture show the inputs) at both shas, into temp journals,
  and compare kinds and payloads.
- **prompt-unchanged:** prepare one run of `workflows/quick-fix.json` with the engine at both shas (verify/engine-actors
  or verify/run-names-one-module show how); compare main's brief.md with the head's prompt.md and the two rows'
  hashes; call spawn at the head on that run and on a copy of main's run folder.
- **v1-reads:** run readFile, `packages/journal/bin/derive.js stalls` and `scripts/inspector/export.mjs` over the
  committed v1 journals named in the Expect line, at both shas.
- **no-translation:** read export.mjs where the capture-row notes were.
- **claude-md:** read CLAUDE.md and run `node --test test/`.
- **behaviour-unchanged:** npm test at both shas; read the test diff and list every change that is not one of the
  named renames.
- **ci:** read the ci and gates checks at the head sha.

This container signs commits: commit evidence holding shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Never run npm test in a checkout and its worktree at
once. Commit `verify/harness-glossary/verdict.json` with a verdict per Expect id.

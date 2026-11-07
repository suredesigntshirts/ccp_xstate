```json
{
  "id": "run-lifecycle-store",
  "title": "Model an agent run's lifecycle explicitly in one run store",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "packages/engine/src/run/store.js owns a run's folder: it alone reads and writes the folder's lifecycle files, reports a run's state (prepared, spawned, bound, returned, failed) and moves it by named transitions that write the file and its journal row together. Every actor hook asks the store for the state, and one table there says what each hook answers in each state, with the catalogue entries used today. The three caps (ten result refusals, one send-back, two stall blocks) are one attempt budget declared once in the store, and run.json counts the attempts spent, so no hook re-reads the journal to count; a run.json written before this counts from its journal rows as today. actors.js is split by knowledge: the store, run/worktree.js, run/accept.js and run/supervise.js, with actors.js keeping prepare, spawn, bind and delivery and still exporting every name it exports today. No model-facing text, rule name, journal row or run-folder file changes.",
  "why": "The run lifecycle exists only as which files exist, checked separately by eight hook functions with three caps, and five of the eight 11-05 fixes patched this module (DDD make implicit concepts explicit, APOSD define errors out of existence; research plan/research/design-books-cleanup.md, finding 4).",
  "serves": [
    "L-count-concepts",
    "L-replan-after-second-fail"
  ],
  "depends_on": [
    "run-names-one-module"
  ],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 4: the eight hooks checking file existence, the three caps, the store, and the split by knowledge"
    },
    {
      "ref": "packages/engine/src/actors.js",
      "what": "readJson, writeJson, writeOnce, storeBlob, loadRun and journal (37-85); githubOf, git, rebuildStart, freeBranch and the worktree add in prepare (126-216); spawn, startedRun, bind, bindLate (265-342); RESULT_RULES, REFUSAL_CAP, resultRefusals and accept (424-596); sent-back.json, openRunOf, handback, stopped (625-694); resultsOf, waitingRecords, waiting (702-770); STALL_CAP, ownedRecords, stallRows, failUnstarted, stall, cannotStart (781-884)"
    },
    {
      "ref": "packages/engine/src/names.js",
      "what": "runDir, agentFile, spawnFile, itemFile, promptFile: the paths the store owns"
    },
    {
      "ref": "packages/engine/messages.md",
      "what": "The catalogue entries each refusal renders today (spawn-already-*, wrong-caller-*, already-*, cannot-start-*, refusal-cap, stall, stall-cap, no-return*)"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs",
      "what": "The hooks that call the engine's functions; it imports actors.js through host.mjs and must not change"
    },
    {
      "ref": "scripts/inspector/export.mjs, packages/journal/src/derive/stalls.js",
      "what": "Read run folders and refusal rows; the file names and rows they read stay as they are"
    },
    {
      "ref": "docs/language.md",
      "what": "The run and run folder lines; the new terms join the engine section"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/run/store.js",
      "what": "The run store: the folder's JSON reads and writes (write-once and atomic), loadRun, the run's journal row, STATES, state(root, run) from the folder, transition(root, run, event, record, row) that writes the event's file once and its journal row and returns false when the run is not in a state the event leaves from, the table of what each hook answers in each state (catalogue entry names), BUDGET { refused: 10, sentBack: 1, stalled: 2 }, spend(root, run, kind) and spent(root, run, kind) over run.json's attempts with the journal fallback, and the queries waiting and owned runs use"
    },
    {
      "ref": "packages/engine/src/run/worktree.js",
      "what": "githubOf, rebuildStart, freeBranch and the worktree add prepare calls"
    },
    {
      "ref": "packages/engine/src/run/accept.js",
      "what": "accept and its checks (agrees, differences, refsIn, hintOf), RESULT_RULES, REFUSAL_CAP (from BUDGET) and refusalText"
    },
    {
      "ref": "packages/engine/src/run/supervise.js",
      "what": "handback, stopped, stall, cannotStart, STALL_CAP (from BUDGET), CANNOT_START, cannotStartPrompt, stallText"
    },
    {
      "ref": "packages/engine/src/actors.js",
      "what": "actors(), prepare, spawn, startedRun, bind, bindLate, boundRun, boundText, confine, resultsOf, deliver, waiting, ownedWaiting, waitingText, and re-exports of every other name it exports at main, so no importer changes"
    },
    {
      "ref": "docs/language.md, packages/engine/README.md, docs/journal.md",
      "what": "run store, run state and attempt budget lines in the engine section; the carried-by paths that move (accept, the brief.stored writer); the run folder's attempts field"
    },
    {
      "ref": "verify/harness-glossary/one-meaning.test.mjs",
      "what": "The only frozen test that changes: the brief.stored writer it pins is in packages/engine/src/run/accept.js, still inside accept's per-role loop"
    },
    {
      "ref": "packages/engine/test/",
      "what": "The builder's tests of state, transition, the answer table and the budget, including a run.json without attempts"
    }
  ],
  "expect": [
    {
      "id": "one-owner",
      "check": "At the head, outside packages/engine/src/run/store.js, no file under packages/engine/src, plugins/harness/scripts or packages/journal/src reads, writes or tests the existence of run.json, spawn.json, agent.json, result.json, failed.json or sent-back.json in a run folder, or writes the spawn or agent pointer files; actors.js, accept.js and supervise.js get each run's state from the store",
      "how": "The verifier's grep of those file names and of existsSync, readFileSync, writeFileSync and writeOnce calls on run folders, and reading each hook",
      "proof": "verifier"
    },
    {
      "id": "states-true",
      "check": "store.state gives prepared, spawned, bound, returned and failed for run folders driven to each state by main's engine (including a run failed by refusal cap, by no-return, by stall cap and by cannot-start), and for the committed run folders under verify/engine-toy-run/evidence and bench/brief/runs; a transition that does not leave from the run's state writes nothing and returns false",
      "how": "The verifier's own test driving runs with main's engine into temp roots, then reading them with the head's store",
      "proof": "verifier"
    },
    {
      "id": "answers-unchanged",
      "check": "For every hook (spawn, bind, bindLate, accept, handback, stopped, stall, cannotStart, waiting, ownedWaiting, resultsOf) called on a run in each state it can see, the head returns the same value (deny, block, refused, fix, failed, allow and prompt) as main, writes the same run-folder files with the same content apart from times, and the same journal rows apart from times, hashes of times and sessions",
      "how": "The verifier's own test calling each hook at both shas from the same starting folders and comparing",
      "proof": "verifier"
    },
    {
      "id": "one-budget",
      "check": "The limits 10, 1 and 2 appear once, in store.js's BUDGET, and REFUSAL_CAP and STALL_CAP are read from it; after each counted refusal, send-back and stall block, run.json's attempts counts it; the run fails at the same attempt as on main; a run prepared by main with refusals and stall rows already in its journal continues from those counts at the head; and no hook outside the store reads the journal to count",
      "how": "The verifier's own test, and a grep for the numbers and for readFile in the run modules",
      "proof": "verifier"
    },
    {
      "id": "split-by-knowledge",
      "check": "worktree.js holds githubOf, rebuildStart, freeBranch and the worktree add, and only it runs git worktree; accept.js holds accept and its checks; supervise.js holds handback, stopped, stall and cannotStart; actors.js is under 450 lines; every name actors.js exports at main is exported at the head with the same value or function behaviour; plugins/harness/scripts is unchanged",
      "how": "The verifier reads the modules, compares actors.js's export list at both shas, and diffs plugins/harness/scripts",
      "proof": "verifier"
    },
    {
      "id": "store-tests",
      "check": "The builder's store tests go red when the store's transition writes the file for an event that does not leave from the run's state, and when spend stops writing run.json",
      "how": "The verifier breaks each and runs the builder's tests",
      "proof": "builder"
    },
    {
      "id": "behaviour-unchanged",
      "check": "Every test that passes on main passes at the head, and the test-file diff changes only the one frozen test the outputs name, plus the builder's new tests",
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
    "adds": [
      "run store (a run's state and transitions, in one module)",
      "attempt budget (run.json attempts against BUDGET)"
    ],
    "merges": [
      "REFUSAL_CAP, the one send-back and STALL_CAP into BUDGET"
    ],
    "removes": [
      "a run's state read as file existence in each hook",
      "the journal re-read to count refusals and stall blocks",
      "actors.js ordered by hook firing order"
    ],
    "budget": 2
  },
  "non_goals": [
    "No model-facing text change: every refusal, block and deny reads as on main (answers-unchanged checks it); one generic 'run is <state>' message, as the research suggested, would change what agents read and is left for an item that measures it",
    "The three limits keep their own values; one shared number across refusals, send-backs and stalls would let stalls spend a builder's refusals and is a behaviour change (plan/decisions/2026-11-07-run-lifecycle-store.md)",
    "Run-folder file names and contents, journal kinds and rows are unchanged, so the inspector, derive.js and committed evidence read as before; run.json only gains attempts once an attempt is spent",
    "plugins/harness/scripts/actors.mjs, the anticorruption layer for Claude Code's terms, does not change",
    "The engine still knows the brief stage by its actor name in accept; stage-contract-declares-rules moves that"
  ],
  "records": [
    "attempts in run.json (refused, sentBack, stalled), the spent budget a run carries; journal rows are unchanged, which answers-unchanged checks"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 3,
    "max_tokens": 1600000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "run.json becomes rewritable (attempts): two hooks spending on one run at once could lose a count. Result returns are sequential per agent and stall blocks come from the owning session's Stop, so they don't overlap; writes stay atomic (rename), and the journal still holds every row",
    "A run prepared by an older release has no attempts; spent() counts its journal rows, which one-budget checks",
    "verify suites that lift source from actors.js (workflow-inspector's writtenBriefOf) find nothing to lift at main already; a suite that pins a function to actors.js is listed in outputs"
  ]
}
```

## What this is

Finding 4 of `plan/research/design-books-cleanup.md`. A run has a lifecycle (prepared, spawned, bound, returned, or
failed), but today it is stored only as which files exist in the run's folder, and eight hooks check those files
each in their own way. Three limits on an agent that isn't delivering (ten refused results, one send-back, two stall
blocks) came from three fix items and live in three places, two of them counted by re-reading the journal.

This item gives the lifecycle one owner, `packages/engine/src/run/store.js`. The store reads the folder into a state,
moves the state by named transitions (spawn, bind, return, fail, send back), and holds the one table of what each
hook says when a run is not in the state it needs. The three limits become one budget table with a count per kind
in `run.json`. `actors.js`, today ordered by when hooks fire, splits by what each part knows: the store, worktrees,
accepting results, and supervising agents that stop or stall.

It is a cleanup: what every hook returns, every row it writes and every file in a run folder stay as on main. The
choices made writing this contract are in `plan/decisions/2026-11-07-run-lifecycle-store.md`.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Keep a second clone at its base on main. Without
reading the builder's tests, write your own under `verify/run-lifecycle-store/`:

- **one-owner:** grep the six run-folder file names and the spawn and agent pointer paths (names.js `spawnFile`,
  `agentFile`) in packages/engine/src, plugins/harness/scripts and packages/journal/src; only run/store.js may touch
  them. Read each hook and show it asks the store.
- **states-true:** drive runs with main's engine (verify/engine-actors, verify/fix-waiting-run-stall and
  verify/fix-refusal-hints show how) into temp roots, one per end state and failure kind; read each with the head's
  store. Also read the committed folders the Expect line names. Call a transition from a state it does not leave
  from and check the folder is unchanged.
- **answers-unchanged:** from the same starting folders, call each hook at both shas and compare returns, files and
  rows (strip times and sessions).
- **one-budget:** grep for 10, 1 and 2 as limits; drive refusals to the cap and stalls to the cap at both shas;
  read run.json's attempts after each; prepare a run with main, spend some refusals and stalls there, then continue
  at the head.
- **split-by-knowledge:** read the four modules; list actors.js's exports at both shas (import both) and compare;
  `git diff main -- plugins/harness/scripts` is empty.
- **store-tests:** break the transition guard and the run.json write in the store, run the builder's tests, show red.
- **behaviour-unchanged:** npm test at both shas; read the test diff.
- **ci:** read the ci and gates checks at the head sha.

This container signs commits: commit evidence holding shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Never run npm test in a checkout and its worktree at
once. Commit `verify/run-lifecycle-store/verdict.json` with a verdict per Expect id.

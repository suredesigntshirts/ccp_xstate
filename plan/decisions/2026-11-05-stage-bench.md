# The stage bench: how a stage runs alone, how it is scored, and how journals stay replayable (2026-11-05)

Plan item `stage-bench`. Why the bench exists and why it comes before an intake stage is in the item and in
`plan/decisions/2026-11-05-prompt-refinement.md`. These are the two-way doors the building thread decided.

## How a stage runs alone

- **A bench session is Claude Code headless (`claude -p`), not an Agent-tool subagent of the thread.** A subagent
  can only be started by a model turn, so it cannot be run k times from a script, and it inherits the thread's own
  context. A headless session can be. It starts in a fresh worktree of the case repository with `brief.md` on stdin,
  and the run's context (the run line) appended to its system prompt. The real harness gives that line at
  SubagentStart, so this is the closest place a headless session has.
- **It returns through the real return path.** The bench's MCP server is named `harness`, so its tool is
  `mcp__harness__return`, a name ending in `harness__return` as the prompt's Return part says. Each call goes to the
  engine's own `accept()` for the run, after the engine's `spawn()` and `bind()` have started it as the hooks do. A
  result the host would refuse is refused and handed back word for word, and the bench records every return.
- **The prompt is the engine's, never the bench's.** For a stage invoked in the initial state (the brief stage), the
  bench starts the item through the real host (`restore()`, then `offer()` the start event), so the journal holds the
  item's first transition and the Inspector replays it. For any other stage it calls the same `prepare()` the host's
  run handler calls, with a recorded input (`--prompt-only --input <run.json>`). Either way the bench sends the
  `brief.md` the engine wrote. For the adopt trial's brief, build and verify inputs on their pinned workflow, the
  output is byte for byte the committed `brief.md`. Running build or verify alone with a model is left to their own
  items, as the item's non-goals say. Their cases need repos with defects, and the Inspector cannot replay an item
  that starts mid-chart.
- **A workflow version is a file, a git revision, or this checkout's file.** The bench loads it with the engine's
  `loadWorkflow`, so a variant is checked as any workflow is and pinned by its hash. A journal's blob (a file named by
  its sha256) is loaded as a pin, with the checks an item started on it keeps. That is how the adopt trial's pre-timer
  workflow still renders.
- **No GitHub.** The bench reads no token and calls no GitHub API. A case whose repository is real names a public
  git URL and commit, and git fetches it. A seed case is committed files made into a one-commit repository, and needs
  no network.

## What reaches a bench session

- **The bench keeps out what it can, and measures the rest.** It turns auto memory off, drops the variables that add
  this host's CLAUDE.md folders and memory path, and loads only project and local settings, so no user hooks or
  plugins run. It then reads the session's transcript, which records the system prompt (`prompt_snapshot`) and every
  context attachment, and records which of this host's marks reached the run. On 5 Nov every run got the attribution
  trailers, the user's email and the skill list. These come from the cloud session's environment, and no flag the
  bench can pass removes them. The ccp_machine_test cases also load that repository's CLAUDE.md, as any session there
  would. Scores are compared only between sets with the same marks, as the prompt-refinement decision says.
- **`confine()` is not enforced** (no harness hooks run). The worktree is a temp folder outside this repository, and
  `bench.json` lists any file the session changed (none did in the baseline).

## How outputs are scored

- **Criteria are mechanical where they can be.** `returned`, `changes-nothing`, `one-check-per-line` (each line
  quoted word for word, in order, and checks numbered 1 to N if numbered) and `no-restated-rules` (branch, base,
  branch-name rule, return mechanics) are code. The other four are judged. The mechanical checks agree with all 10
  hand grades.
- **One fresh judge session per judge criterion per output,** with its own short system prompt, no tools, no MCP
  servers and a JSON schema for the verdict. The judge sees only the criterion, the case list it needs, the expect
  lines, the repository's file list and package scripts (for runs-as-written), and the output. A verdict is kept in
  `judge/<criterion>.json` with the hash of the exact prompt and the judge model, and reused while both are the same.
  So the committed scores recompute exactly, and changing either asks again. The judge model is `claude-opus-5-5`,
  the same as the stage's: the blind A/B read in the procedure, by a session that has seen neither version, is the
  guard against self-preference, not a different judge model.
- **The rubric is approved by this thread as the person's stand-in** (the item says so): the eight criteria in
  `bench/brief/rubric.json`, taken from the brief stage's own rules, the 4 Nov stage critique, and the follow-up
  that a brief command could not run as written.
- **The judge check found three of my hand grades wrong, and I corrected them only after checking the output.** On
  the first pass the judge agreed 6 of 10 on words-only and avoids-must-not. It was right on three points the
  building thread had missed. First, the adopt trial's real check 3 command throws `Unterminated group` (run in the
  case repo, and the fault the 4 Nov follow-up had already noted). Second, requiring a `### name(` heading is a README
  layout the line does not force. Third, fri-102's "mutate lint() mentally" does not show the tests run. The
  planted-bad entries were then rebuilt on a hand-fixed base (`fixed-adopt`), so each differs from a good output only
  by its planted fault. Final: 10 of 10 on every criterion, and 9 of 9 planted faults caught. Each correction is in
  its entry's `notes`.

## Tokens

- `fresh` counts input, cache writes and output: what a run newly spends. `total` adds cache reads. A headless
  session re-reads its cached system prompt on every turn, so `total` is about 8 times `fresh`. The item's
  `step_back.max_tokens` (1.5M) is read as fresh tokens. Spent: the 21 baseline runs used 312,771 fresh tokens
  (2,521,230 total), and 124 judge sessions used 531,236 fresh (653,571 total). With the first trial run, about 0.9M
  fresh tokens in all. Counted as total tokens, the item went over the cap, at about 3.2M. That reading would have
  forced a step back before the baseline had 3 runs per case. The cost was $3.80 for the stage runs.

## Edit-safe: journals replay on the blob they pinned

- **The rule.** A committed journal replays on the workflow bytes its items pinned (`<name>@<sha256>`, read from
  the journal's own `blobs/`), never on today's `workflows/*.json`. The engine already worked this way: `restore()`
  takes the spec it is given, and `workflowOf()` loads an item's pin. Only tests passed it the current file.
- **The one done item's test that changed.** `verify/trial-fail-path/lib.mjs` loaded `quick-fix` by name, so any
  edit of `workflows/quick-fix.json` made restore() fail with "the workflow changed". It now loads the journal's pin.
  The first test still checks that every applied row names one pin, and that the committed blob hashes to it. The
  driver re-run in the `real-agents` test now gets the pinned bytes as its `workflows/quick-fix.json`, so it still
  checks that the re-run starts with the committed prompt byte for byte. Both test the same outcome as before,
  against the pinned blob: the change the item allows.
- **A new repo test, `test/journals-replay.test.mjs`,** replays every git-tracked `*/items/*.jsonl` on its pin,
  including the bench's run sets. One journal from before pins existed (`verify/engine-host/one-owner-evidence`) is
  listed, not replayed.
- **Checked on 5 Nov:** with rule 4 of `meta.actors.brief` changed in a scratch worktree, `npm test` on main failed
  only the trial-fail-path replay tests (and the local-only `setup.test.mjs` release-tag test that fails on this
  machine either way). With this item's change, the same edit leaves them green.

## What would change these

- If a bench run and a real stage run on the same input differ in ways that matter (a refusal the bench never sees,
  say), the session setup is wrong: compare their transcripts before trusting more bench numbers.
- If the person reads the words-only criterion as too strict (for example, they want an exit-status test inside a
  behaviour check allowed), its wording in `rubric.json` changes. The judge is not told to be lenient.

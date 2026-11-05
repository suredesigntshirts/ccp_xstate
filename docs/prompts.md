# Stage prompts: where they come from, how to inspect them, how to refine them

A model stage's prompt is assembled in one place, `packages/engine/src/stages.js` (`sections()` and `render()`), from
the stage's file, its entry in the workflow JSON and the run's input. Nothing else writes a prompt. The stage bench
(`scripts/bench/`, plan item stage-bench) runs one stage alone on fixed cases with that exact prompt, scores its
output per rubric criterion, and compares two workflow versions. Changing a prompt is a PR to the stage's file,
backed by a bench report. Why it is done this way: `plan/decisions/2026-11-05-prompt-refinement.md` and
`plan/decisions/2026-11-05-stage-bench.md`.

## Stage files

Each model stage's words live in one markdown file beside its workflow, `workflows/<workflow>/<stage>.md`, named by its
entry in the workflow JSON (`"prompt": "quick-fix/brief.md"`). The JSON keeps the wiring and the output schema. A stage
file is a `# <stage>` title, then `## Rules`, `## Inputs`, `## Output`, and `## Task` for a stage whose invoke takes a
fixed task. Rules are `- <rule>` items; Inputs and Output are `- <name>: <text>` items, Output in the schema's property
order. Each item is one line: do not wrap it. The Task is the lines under its heading, as written. Anything else in the
file is refused at load with its file and line (`packages/engine/src/prompts.js`).

The engine fills the files into the workflow (`readWorkflow()`) and pins those filled-in bytes, so editing a stage file
changes the pin, a finished item replays on its blob alone, and each run's `stage.json` names the file and line of
every piece that came from one; the Inspector shows them. Claude Code's own agent definitions (`.claude/agents/`,
`~/.claude/agents/`, a plugin's `agents/`) are not used for stages: `plan/decisions/2026-11-05-stage-prompt-files-ready.md`.

## Where each part of a prompt comes from

| Part | Text | Where it lives |
|---|---|---|
| Rules | The data rule and the worktree rule | Constants in `packages/engine/src/stages.js` (`DATA_RULE`, `WORKTREE_RULE`), the same for every stage |
| Rules | Who the stage is, what it must not do, when to return | `## Rules` of the stage file, for example `workflows/quick-fix/brief.md` |
| Inputs | Each input's name and meaning | `## Inputs` of the stage file |
| Inputs | Each input's value | The run's input, wired by the state's `invoke.input`: a context path (written by an earlier stage or the item's start) or a literal |
| Task | The stage's job | The input named `task`. For brief, `## Task` of its stage file, wired as `{ "prompt": "task" }` in `states.briefing.invoke.input.task`. For build and verify, the briefs the brief stage wrote |
| Output | One line per described field, then the schema | `## Output` of the stage file (one line per field), then the schema in `meta.actors.<stage>` of the workflow JSON |
| Return | How to call the return tool | `returnLine()` in `stages.js`, filled with the run id |

Not in the prompt: the run's context (its run id, worktree, repository and branch, from `contextOf()`), which the
harness hands the agent at SubagentStart, and Claude Code's own system prompt with whatever this host adds to it.
The harness does not record the system prompt in real runs. The bench records it per run (see Conditions).

## Inspecting a run

Every model run has a folder `<journal>/items/<item>/runs/<n>.<stage>/`:

| File | What |
|---|---|
| `brief.md` | The exact prompt, byte for byte (also under `<journal>/blobs/<sha256>`) |
| `context.md` | The run line the agent was given besides the prompt |
| `stage.json` | Every prompt piece with its source, every input with who produced it, and where the output went |
| `run.json` | The run's input, schema and facts; `render(run.json)` gives `brief.md` again |
| `result.json` | The accepted result |

The Workflow Inspector (`docs/inspector.md`) shows all of it for any journal root. A bench run folder is a journal
root, so a config with one source shows it:

```
node -e "require('fs').writeFileSync('/tmp/bench-inspector.json', JSON.stringify({engines:{'.':'Main'},sources:[{origin:'Bench',kind:'real',engine:'.',journal:'bench/brief/runs/baseline/planted-half-met.1',label:'Bench: planted-half-met.1'}]}))"
node scripts/inspector/build.mjs --config /tmp/bench-inspector.json --out /tmp/bench-inspector
```

Open `/tmp/bench-inspector/index.html`. A bench run has no live capture, so its tool calls are in the run's
`transcript.jsonl` instead.

## The bench

| Path | What |
|---|---|
| `scripts/bench/run.mjs` | Runs one stage k times per case; or `--prompt-only` prints the prompt for a case or a recorded input |
| `scripts/bench/score.mjs` | Mechanical checks, then one judge session per judge criterion per output; `--judge-check` checks the judge |
| `scripts/bench/compare.mjs` | Two scored run sets, per case and criterion, with what changed in the stage entry; `--blind` writes a blind A/B packet |
| `scripts/bench/return-server.mjs` | The `harness` MCP server whose `return` tool calls the engine's `accept()` |
| `scripts/bench/stages.mjs` | Per stage: its workflow, its mechanical criteria, and how a judge and a blind reader see a case and an output. A stage needs an entry here to be scored or compared |
| `bench/<stage>/rubric.json` | The criteria, each mechanical or judged, and `workflow`, the workflow the stage belongs to (quick-fix when absent) |
| `bench/<stage>/cases/<id>/case.json` | One case: its repository (`repo/` seed files, or a public git URL and commit), the stage input, `must_catch`, `must_not` |
| `bench/<stage>/judge-check/` | Hand-graded outputs, some planted bad, and the judge's kept verdicts and agreement (`judged/`) |
| `bench/<stage>/runs/<set>/` | Run sets; `baseline/` is today's prompt |
| `bench/<stage>/reports/` | Reports: `baseline.md` |

A bench run is Claude Code headless (`claude -p`) started in a fresh worktree of the case repository, with
`brief.md` on stdin and the run's context appended to its system prompt. Its one MCP server, `harness`, gives it
the return tool its prompt names, and every call goes to the engine's real `accept()`, which refuses a bad result as
it does in a real run. The bench has no GitHub access and needs none. A case with a `git` repository fetches that
public repository with git; a case with a `repo/` seed folder needs no network at all. Each run's folder is a
journal root holding the engine's own run folder, and also `bench.json` (model, workflow version, time, tokens,
cost, what of this host reached the session, the return calls) and `transcript.jsonl` (the session's text and tool
calls, cut down).

## Benched stages

| Stage | Workflow | Bench | What its cases plant |
|---|---|---|---|
| brief | quick-fix | `bench/brief/` | Half-met lines, after-merge lines, a missing line, a prescribed fix, real product-repo issues |
| shape | intake | `bench/shape/` | Raw requests: a rule the repo half-breaks, a suggested fix that defeats the need, a shared parser with no old-path line, a bug with no regression asked for, an after-merge ask, a question that is no change, one real request |
| challenge | intake | `bench/challenge/` | Shaped issues with one planted hole each (half-met, ambiguous, after-merge, missing regression, adopted wrong fix) and two sound issues that must PASS; per-line verdicts are scored mechanically against the case's `must_fail`, `must_pass` and `result` |

The intake workflow (`workflows/intake.json`, plan item wf-intake) turns a request into a frozen issue before any
build: shape writes it, challenge tries to break it, shape revises at most twice, and the frozen issue starts a
quick-fix child item. A stage invoked in the initial state (brief, shape) is started through the real host from
the case's item input; any other (challenge) is prepared from the case's stage input. Use `--stage <stage>` with
every command below; the workflow comes from the rubric.

## Commands

From a clean clone, after `npm ci`. Commands that run a model cost real tokens; they say so.

See the prompt a case gets, with no model run:

```
node scripts/bench/run.mjs --stage brief --prompt-only --case planted-half-met
```

The prompt for a recorded input, on the workflow version that run pinned (here the adopt trial's build run):

```
node scripts/bench/run.mjs --stage build --prompt-only --input tournaments/2026-11-04-stage-contract/trials/adopt/journal/items/trial/runs/1.build/run.json --run-id trial:1.build --workflow tournaments/2026-11-04-stage-contract/trials/adopt/journal/blobs/8dc9451a45169814fabaca1c7e91772f0ebf4452deb90aa57e1604750f2d394b
```

Check the judge against the hand grades (reuses the kept verdicts; asks the judge again only for a changed prompt or
another model):

```
node scripts/bench/score.mjs --stage brief --judge-check
```

Recompute the baseline's scores and report from its run folders and kept verdicts, with no model run:

```
node scripts/bench/score.mjs --stage brief --runs bench/brief/runs/baseline --no-judge --report /tmp/bench-baseline.md
```

The committed `bench/brief/reports/baseline.md` was written by the same command with `--title` and `--notes <file>`,
which add its title and its hand-written "What the baseline shows" section; every table is the same.

Run one case once (one model session, about 15,000 to 30,000 fresh tokens):

```
node scripts/bench/run.mjs --stage brief --case planted-half-met --k 1 --out /tmp/bench-try --model claude-opus-5-5
```

Make a one-rule variant of the workflow, run it on one case three times, score it (three sessions, then four judge
sessions per run), and compare it with the baseline:

```
rm -rf /tmp/qf-variant && cp -r workflows /tmp/qf-variant
sed -i 's/^- Use paths from the repository root\.$/- Use paths from the repository root, and check that every command you give runs as written in this repository before you return./' /tmp/qf-variant/quick-fix/brief.md
node scripts/bench/run.mjs --stage brief --case planted-half-met --k 3 --workflow /tmp/qf-variant/quick-fix.json --out /tmp/bench-variant --model claude-opus-5-5
node scripts/bench/score.mjs --stage brief --runs /tmp/bench-variant --report /tmp/bench-variant.md
node scripts/bench/compare.mjs --stage brief --a bench/brief/runs/baseline --b /tmp/bench-variant --out /tmp/bench-compare.md --blind /tmp/bench-blind
```

`compare.mjs` compares only the cases both sets ran, and names the ones it left out. `bench/brief/reports/example-variant-compare.md` is these four commands' output from 5 Nov, with the variant's runs in
`bench/brief/runs/example-variant/`: one case and 3 runs, too few to decide anything, kept as a worked example (it
shows a trade: runs-as-written 1/3 to 2/3, words-only 2/3 to 1/3). `/tmp/bench-blind/packet.md` is the blind read's packet;
`key.json` beside it says which output is which and is not shown to the reader.

## The refinement procedure

A thread that refines a stage's prompt follows these steps, in order, and links each step's output in its PR.

1. **Rubric.** Write or update `bench/<stage>/rubric.json`: what a good output must do, one criterion per line, each
   mechanical where it can be. The person approves the rubric, or a stand-in does and records it in
   `plan/decisions/`. The person judges outcomes, not wording: they never need to read the prompt.
2. **Cases.** At least 6 in `bench/<stage>/cases/`: some from real runs (their input and the repository at the
   commit they ran on), some planted, each with a trap that really is in its repository. Every case has `must_catch`
   (what a good output does about the trap) and `must_not` (what a bad one does).
3. **Judge check.** At least 6 hand-graded outputs in `judge-check/`, at least 3 planted bad. Run
   `score.mjs --judge-check`. It must catch every planted fault (it exits 1 otherwise) and agree with the hand grades
   on each criterion. Where it disagrees, find out who is right by reading the output again or running its commands.
   Fix the hand grade or the criterion's wording, never the judge's answer, and record each correction in the entry's
   `notes`. Scores are not trusted until this passes.
4. **Baseline.** Run today's prompt, at least 3 runs per case, score it, and write `bench/<stage>/reports/<name>.md`
   with `score.mjs --report`. Commit the run folders with the report.
5. **Proposal.** Pick one criterion the baseline fails. Change the stage file so it addresses that criterion,
   and nothing else: one rule, one input meaning, one field description or the task. Write down which criterion it
   targets and why the change should help.
6. **Rerun.** Run the variant on the same cases with the same k, model and conditions, with `--workflow <variant>`
   (the variant's `<workflow>.json` in a copy of `workflows/`, its stage files beside it),
   and score it.
7. **Compare.** `compare.mjs --a <baseline> --b <variant>`. Keep the change only if the targeted criterion improves
   and no criterion is worse, or the person accepts the trade in writing. Compare only sets run under the same
   conditions: same model, and the same ambient marks in their reports.
8. **Blind read.** Hand `packet.md` from `compare.mjs --blind` to a fresh session that has seen neither workflow
   (a new thread, or `claude -p` from an empty folder). A model tends to prefer its own text, so the builder of the
   change never does this read. Record its answer and the key in the PR.
9. **PR.** One PR changes the stage file and adds the variant's run folders and the compare report, through the
   usual gates (`docs/gates.md`). Finished items keep replaying on the workflow they pinned (`test/journals-replay.test.mjs`),
   so the edit leaves their tests green; only tests that assert the workflow file's current contents need updating.

If a bench score fails to predict real-run outcomes (a prompt that scores better does worse in real items), the cases
or the judge are wrong: fix those before trusting another bench-driven change.

## Conditions

What differs from a real stage run, so that scores are compared only between runs made under the same conditions:

- The session is a headless main session, not a subagent of the host thread. The run's context is appended to the
  system prompt, where a real run gets it at SubagentStart.
- No harness hooks run, so `confine()` does not hold the session to its worktree. The worktree is a temp folder
  outside this repository, and `bench.json` lists any file the session changed.
- The bench turns auto memory off and drops the variables that add this host's CLAUDE.md folders. What still
  reaches the session is read from its transcript and recorded per run under `ambient`. On this host on 5 Nov that
  was the attribution trailers, the user's email and the skill list. The case repository's own CLAUDE.md, if it has
  one, is loaded as it would be for any session there.
- Tokens: `fresh` is input plus cache writes plus output, the tokens a run newly spends; `total` adds cache reads.

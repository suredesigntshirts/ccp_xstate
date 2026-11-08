# Workflow Inspector

One HTML page that shows, for any ccp_xstate workflow run, how the item moved through its workflow, how its context
was created and changed at each step, and exactly what every model agent was given, did and returned, and whether the
host accepted it. It works for any workflow JSON on any engine checkout that explains its transitions
(`packages/engine/src/explain.js`).

Its first job is to say **where every piece of text came from**, and to say plainly what was never recorded. It
shows what the engine recorded and says, never its own reading of the workflow or the engine's code: the map is the
engine's `chart()`, each step's ways out are the engine's `explain()`, and everything about a model run comes from
its stage record (`stage.json`) and `run.json`.

## Files

| Path | What |
|---|---|
| `scripts/inspector/export.mjs` | One item of one journal root, replayed on one engine checkout, as a JSON bundle |
| `scripts/inspector/build.mjs` | Many sources to one folder: `index.html` (a copy of `page.html`) and `data.js` |
| `scripts/inspector/page.html` | The page. Self-contained: no CDN, no fonts, no network |
| `scripts/inspector/sources.json` | The sources the build reads by default. Its paths are this machine's |
| `scripts/inspector/check-page.mjs` | Opens a built page in headless Chromium: every run, step, workflow and compare pair at 390px and 1280px, failing on console errors, sideways page scroll, a table wider than its box at 1280px, or a scripted step that claims Claude Code started its agent |
| `scripts/inspector/test/` | node:test tests; `node --test scripts/inspector/test/` or `npm test` |

## Build

```
node scripts/inspector/build.mjs                       # sources.json -> /home/user/inspector-out/
node scripts/inspector/build.mjs --config my.json --out some/dir --capture /tmp/wi-capture
```

Open `index.html` from the output folder in a browser; `data.js` must sit beside it. A source that is missing is
skipped and named, both in the build's output and at the foot of the page.

Check the built page (needs Playwright and a Chromium; neither is a dependency of this repo):

```
node scripts/inspector/check-page.mjs --out /home/user/inspector-out [--playwright <playwright/index.mjs>] [--chrome <binary>]
```

One run on its own, as JSON:

```
node scripts/inspector/export.mjs --engine <checkout> --journal <journal root> [--item <id>] \
  [--workflow <file.json>] [--kind real|scripted] [--label <text>] [--origin <text>] [--out bundle.json]
```

## Sources

`sources.json` lists sources of two kinds:

A string `engine` or `journal` is relative to this repo's root, so `"."` is this checkout and a committed journal
(such as the adopt trial, `tournaments/2026-11-04-stage-contract/trials/adopt/journal`) is named by its repo path. An
engine `{ "commit": "<sha>" }` is this repo at that commit: the build checks it out once as a git worktree under the
capture folder and links this checkout's `node_modules` into it. A shallow clone may lack the commit; the source is
then skipped and named.

- **A journal root** (`engine`, `journal`, `kind`, `label`, `origin`): a folder with `items/<item>.jsonl`, the
  items' run folders, and maybe `sessions/*.jsonl` (the live capture). Every item in it becomes a run on the page.
- **A scenario** (`engine`, `scenario`, `label`, `origin`): a scenario test of an engine checkout, such as
  `packages/engine/test/tourney/Q1.test.js`. The build runs it with `node --test` and `TMPDIR` pointed at a capture
  folder, so the journal roots the test makes in its temp folders are kept. The test is not edited. Each root becomes
  a run, named after its test when the count matches.

`engines` (optional) names each engine checkout for the page ("Main"). Every `workflows/*.json` of every engine
checkout is also shown on its own, under "Workflows (map only)", with its map and a table of all states and ways out,
even when no run of it was captured.

**What is refused.** The exporter refuses an engine checkout without `explain.js` (one older than the engine's
explanation), and a journal whose model run has a prompt but no `stage.json` (recorded before stage records, such as
the October runs in the shared folder). The build skips such a source and names why, at the foot of the page.

## How it reads a run, without knowing the workflow

- **Workflow.** If the journal's first row pins the workflow (`name@<sha256>`), the exact bytes come from the
  journal's `blobs/`. Otherwise the file given with `--workflow`, else `<engine>/workflows/<name>.json`, and the page
  warns that it may have changed since the run.
- **Map.** The engine's `chart()` of the workflow: every state, and every transition (a state's `on` and `after`, an
  invoke's `onDone` and `onError`), each named by its JSON pointer in the workflow file. Those are all the transitions
  the engine runs: its load check refuses the rest.
- **Context.** The journal keeps only a hash of the context, so the exporter replays the journal's events through
  the checkout's own `spec.js` (`machineOf`, `hashOf`) and its own `xstate`, and checks each hash. Where replay fails
  or differs, the page says so and keeps showing what the journal itself holds.
- **Ways out tried.** For each step, the engine's `explain(spec, snapshot, event)` on the snapshot before it: the
  transitions it tried for that event, in its order (the deepest active state first, each state's transitions in file
  order), each with its guard, the needs of the state it enters and which of them failed, up to the one it took. The
  check is `failingOf` in `spec.js`, the same one the machine's guards run. An event the engine ignored lists what it
  tried, none taken; "nothing listens for it" is said only when it tried nothing.
- **Step labels.** The taken transition's `description` in the JSON, else words made from the event and target.
- **Actors.** From the journal's `engine.effect` start rows, each matched to its invoke in `chart()`. An actor is a
  model agent when its run folder has a stage record (`stage.json`); anything else is host code, shown with its card
  or outcome.
- **Who wrote the prompt.** The producers of the Task part's pieces in the stage record: the brief agent's field, a
  literal in the workflow JSON, or the item's start input. A stage with no Task part is the harness frame around the
  rules, inputs and output its workflow names.
- **Where each part came from.** The prompt is split into the stage record's pieces, in part order, each coloured by
  its recorded source: the harness frame (a fixed or filled-in catalogue entry), the workflow (a JSON pointer or a
  stage file line) or an input. The text between pieces is the frame's part headings and line breaks. If the prompt
  file does not hold the pieces in order, the page says so and marks the whole text unknown. The added context is the
  record's context piece.
- **Schema and stored result.** Layer 4 is `run.json`'s schema, the one the host checks the return against; the agent
  saw it in the Output part of its prompt. Layer 6 is `result.json`, what the host stored, with the paths the stage
  record lists as `stamped` marked as the host's.
- **Runs that never returned** say where the item went instead (the next step that left the run's state), or that
  the journal ends while the run was open.
- **Trace.** Rows of the live capture whose agent is the run's agent (`agent.json`). Only the tool name, time, size
  and paths are kept, never the command itself.

## The stage record (stage.json)

The engine (`packages/engine/src/trace.js`; the format is in `docs/journal.md`) writes `runs/<n>.<actor>/stage.json`
for every model stage run. The exporter puts it in the run's bundle as `stage` (`stageView` in `export.mjs`), with every run id it names resolved to
a run of the same item, and the page shows it as the run's **Stage** view, before the seven layers:

1. **Instructions**: the prompt part by part (rules, inputs, task, output, return), each piece with its source: a
   harness frame constant or template, a JSON pointer in the workflow file, or an input with the run that produced it.
2. **Inputs**: each input's meaning, value, the context path it was read from and its producer, as a link to the
   producing run (stage, effect or child workflow; the host for a field it stamped on a returned ref) or a plain label
   (start input, literal, event, copy, context default, parts, nothing). Later writes to parts of it are listed.
3. **Output**: the value (or error, or that the run was stopped), with the paths the harness stamped marked, each
   context path written from it with the earlier write it replaced, and the invokes
   that could read it next, each with its later run in this item: "read it" when that run's own record names this run
   as the producer, "read a newer value" when it does not, and a host effect's run marked as not traced. A reader that
   is the writing invoke itself (`self`) is shown as read by itself on the next round.

The bundle also gets `flow`: the item's runs in start order with the context paths between them, shown above the
steps as "Data flow between stages".

## What it cannot show

- Claude Code's own system prompt, tool list and CLAUDE.md files: the harness never records them.
- The exact commands an agent ran: the capture stores only a hash of each tool's input.
- The messages the parent session sends when it resumes an agent (after it finished without returning, or after a
  handback): only that a resume happened is known.
- Anything about a model in a scenario: those agents are test fixtures, GitHub is a fake server, and no model ran.
  Their prompts still show what that engine would hand a real agent.
- Runs recorded before stage records, and engines without `explain.js`: they are refused, not guessed at.

## How it words what became of a model run

- An event the engine ignored lists every way out that listens for it on the active state, its ancestors and the root,
  with which guard or need failed on the unchanged context. "Nothing listens for it" is said only when none does.
- A run with no stored result is described from the evidence, in this order: a `failed*` file in the run folder or
  an `xstate.error.actor.<id>` step that took it ("failed: never returned"), refusals of return-tool calls ("returned
  N times, each refused (rule)"), a capture `agent.finish` row ("finished at T without calling the return tool"), the
  item leaving the state, and only then "no answer yet". A refusal with rule `no-return` (or of a tool other than the
  return tool, such as `SubagentHandback`) is a handback refused and sent back, never counted as a return.
- When an agent finishes more than once, each later finish took in a further message: a resume by the parent session
  (a second `agent.spawn` row with the same agent id) or a reply after a handback. Its time and token counts carry on,
  which is how the capture shows one conversation. The text of that message is not recorded, so layer 2 marks the
  agent "resumed, message not recorded" and says the prompt file is its first message, not everything it was told.
- Live-capture rows `agent.final` and `agent.prompt` are the capture hook's hashes of the agent's final message and
  prompt, shown as by "capture". Layer 7 holds the harness's own rows. The exporter reads rows through the journal's
  upcast, so a v1 journal shows these kinds too.

# Workflow Inspector

One HTML page that shows, for any ccp_xstate workflow run, how the item moved through its workflow, how its context
was created and changed at each step, and exactly what every model agent was given, did and returned, and whether the
host accepted it. It works for any workflow JSON and any engine checkout: main's, or a tournament lane's.

It was built because a person reading a real run found that the brief actor's prompt is a bare template ("Do what the
brief step asks") with no authored instructions. So the page's first job is to say **where every piece of text came
from**, and to say plainly what was never recorded.

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

- **A journal root** (`engine`, `journal`, `kind`, `label`, `origin`): a folder with `items/<item>.jsonl`, the
  items' run folders, and maybe `sessions/*.jsonl` (the live capture). Every item in it becomes a run on the page.
- **A lane scenario** (`engine`, `scenario`, `label`, `origin`): a scenario test of a tournament lane checkout, such
  as `packages/engine/test/tourney/Q1.test.js`. The build runs it with `node --test` and `TMPDIR` pointed at a
  capture folder, so the journal roots the test makes in its temp folders are kept. The test is not edited. Each root
  becomes a run, named after its test when the count matches.

`engines` (optional) names each engine checkout for the page ("Lane A"). Every `workflows/*.json` of every engine
checkout is also shown on its own, under "Workflows (map only)", with its map and a table of all states and ways out,
even when no run of it was captured.

## How it reads a run, without knowing the workflow

- **Workflow.** If the journal's first row pins the workflow (`name@<sha256>`), the exact bytes come from the
  journal's `blobs/`. Otherwise the file given with `--workflow`, else `<engine>/workflows/<name>.json`, and the page
  warns that it may have changed since the run.
- **Graph.** From the JSON alone: every state (nested and parallel too), and every `on`, `after`, `always`, invoke
  `onDone` and `onError`, and a compound state's own `onDone`. No state name is built in.
- **Context.** The journal keeps only a hash of the context, so the exporter replays the journal's events through
  the checkout's own `spec.js` (`machineOf`, `hashOf`) and its own `xstate`, and checks each hash. Where replay fails
  or differs, the page says so and keeps showing what the journal itself holds.
- **Step labels.** The matched transition's `description` in the JSON, else words made from the event and target.
- **Actors.** From the journal's `engine.effect` start rows. An actor is a model agent when its run folder has a
  `brief.md`; anything else is host code, shown with its card or outcome.
- **Who wrote the prompt.** If the actor's input had a `brief` text equal to `brief.md`, it was passed through:
  the page names the context path the workflow maps into `input.brief`, the step that put it there and the field of
  the result it came from, and says in turn who prompted that agent. Otherwise the engine filled its `writtenBrief()`
  template, and the page shows that code from the checkout's `actors.js`. When the template wraps a literal from the
  workflow JSON (an invoke input such as `task: { value }`), the prompt is credited to the workflow author
  (`template+workflow`); "nobody wrote it" is said only when the template and the actor input are all of it. "Where each part came from" colours the text: engine template, workflow JSON
  literal, actor input, run values, or passed through.
- **Schema and stored result.** Layer 4 shows the schema the agent was shown (the schema JSON in `context.md`); if
  it differs from `run.json`'s, the difference is named and both are shown. Layer 6 is `result.json`, what the host
  stored; fields the host wrote itself are marked: keys the agent-facing schema removed, and keys the added context
  tells the agent never to set ("Never set key, gates or green", "Don't include an \"attested\" field").
- **Ways out tried.** For each step the page lists the transitions the engine tried for that event, in order, each
  with its guard and the needs of its target, and which failed, using the checkout's own `failing()` on the context
  the transition's actions would leave. A join (a group finishing) is shown as a second list.
- **Runs that never returned** say where the item went instead (the next step that left the run's state), or that
  the journal ends while the run was open.
- **Trace.** Rows of the live capture whose agent is the run's agent (`agent.json`). Only the tool name, time, size
  and paths are kept, never the command itself.

## What it cannot show

- Claude Code's own system prompt, tool list and CLAUDE.md files: the harness never records them.
- The exact commands an agent ran: the capture stores only a hash of each tool's input.
- The messages the parent session sends when it resumes an agent (after it finished without returning, or after a
  handback): only that a resume happened is known.
- The raw return of an agent, where the engine stores only its stamped version (lanes A and C): host-written fields
  are marked from the rules the context states, not from a stored copy of the return.
- That a `template` prompt is byte for byte what `writtenBrief()` gives today: the code is shown, not re-run.
- Anything about a model in a lane scenario: those agents are test fixtures, GitHub is a fake server, and no model
  ran. Their prompts still show what that lane's engine would hand a real agent.

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
  agent "resumed, message not recorded" and says brief.md is its first message, not everything it was told.
- Live-capture rows `result.stored` and `brief.stored` are the capture hook's hashes of the agent's final message and
  prompt, shown as by "capture": they are not the harness accepting anything. Layer 7 holds the harness's own rows.

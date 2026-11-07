# The harness's language

One word per thing, and one thing per word, within each context. The harness has four contexts that meet in the same
files: the plan, the engine, the platform it runs on, and the records it keeps. A term below means only what its
line says in that context. Use these words in code, tests, docs and PRs. Before introducing a new term, add its line
here, in the context it belongs to (CLAUDE.md, "Principles").

Each line names the code, file or row kind that carries the term.

## Plan

How the work on the harness itself is planned and proved.

| Term | Means | Carried by |
|---|---|---|
| item | One piece of work with a frozen contract: outcome, Expect lines, Verifier brief | `plan/items/`, `plan/item.schema.json` |
| plan stage | A step of the build, s0 to s6, with its own gate | `plan/stages/` |
| Expect line | One check the outcome must pass, with its proof (`world`, `verifier` or `builder`) | `plan/item.schema.json` `expect` |
| verdict | The verifier's MET or NOT MET for every Expect line of an item, at one sha | `verify/<item>/verdict.json`, `scripts/gates/lib.mjs` |
| ledger row | A lesson the plan is held to, with an `L-` id | `plan/ledger/` |
| decision | A two-way door decided and written down, or a one-way door waiting for the person | `plan/decisions/`, `plan/decisions/waiting-for-person.md` |
| replan | A PR that changes only `plan/`, labelled `replan` | `scripts/gates/pr-gate.mjs` |

## Engine

How a workflow carries an item through its states. An engine item is the same idea as a plan item: one piece of work.

| Term | Means | Carried by |
|---|---|---|
| workflow | An XState machine as JSON: states, transitions, and the `meta.actors` it invokes | `workflows/quick-fix.json`, `packages/engine/src/spec.js` |
| item | One piece of work carried through a workflow, with its own journal file | `packages/engine/src/names.js` `itemFile`, `packages/engine/src/host.js` `restore` |
| state | Where an item is in its workflow | `packages/engine/src/host.js` `applyEvent` |
| actor | Anything a state invokes: a model stage, a host effect, or a child workflow | `packages/engine/src/effects/index.js` |
| model stage | An actor an agent plays, defined by a stage file and an output schema. Say model stage wherever stage could be read as a plan stage | `packages/engine/src/stages.js` `isStage`, `workflows/quick-fix/build.md` |
| host effect | An actor the host runs itself: merge, ask, post | `packages/engine/src/stages.js` `EFFECTS`, `packages/engine/src/effects/` |
| stage file | A model stage's prose: rules, inputs and task | `packages/engine/src/prompts.js`, `workflows/quick-fix/` |
| brief stage | The model stage that writes the per-role briefs the later stages work from | `workflows/quick-fix/brief.md` |
| brief | One role's instructions, returned by the brief stage and fixed before any build starts; only this is a brief | `brief.stored`, `packages/engine/src/run/accept.js` `accept` |
| run | One invocation of a model stage for an item, with id `<item>:<seq>.<invoke>` | `packages/engine/src/names.js` `runOf` |
| run folder | A run's files: `prompt.md`, `context.md`, `run.json`, `stage.json`, `result.json` | `packages/engine/src/names.js` `runDir` |
| run store | The one owner of a run's folder: reads its run state and moves it by transitions | `packages/engine/src/run/store.js` `state`, `transition` |
| run state | Where a run is in its lifecycle: prepared, spawned, bound, returned or failed | `packages/engine/src/run/store.js` `STATES` |
| attempt budget | How many refused results, send-backs and stall blocks a run may spend before it fails | `packages/engine/src/run/store.js` `BUDGET`, `run.json` `attempts` |
| prompt | The exact text a run's agent starts with, rendered from its stage file and input | `prompt.md`, `packages/engine/src/names.js` `promptFile`, `prompt.stored` |
| context | The run's facts (run id, worktree, repo, branch), given to the agent once beside its prompt | `context.md`, `packages/engine/src/stages.js` `contextOf` |
| stage record | Every piece of a run's prompt with its source, and where its output went | `stage.json`, `packages/engine/src/trace.js` `stageRecord` |
| result | What a run's agent returns, checked against its output schema | `result.json`, `result.stored` |
| return | The one way a result comes back: the return tool, whose call the hook accepts or refuses | `plugins/harness/scripts/return-tool.mjs`, `packages/engine/src/run/accept.js` `accept` |
| card | A decision put in front of the person by the ask effect | `packages/engine/src/effects/card.js`, `packages/engine/src/names.js` `cardFile` |
| catalogue | Every sentence of code the harness hands a model, one entry each | `packages/engine/messages.md`, `packages/engine/src/messages.js` |

## Platform

What the harness runs on: Claude Code and the Hearth project threads.

| Term | Means | Carried by |
|---|---|---|
| session | One Claude Code conversation, named by its `Claude-Session` URL | `session.fingerprint`, `packages/engine/src/names.js` `sessionFile` |
| agent | A Claude Code subagent, started with the Agent tool; a run's agent is bound to its run | `agent.spawn`, `packages/engine/src/names.js` `agentFile` |
| hook | A Claude Code hook the harness plugin registers | `plugins/harness/hooks/hooks.json` |
| actor hooks | The plugin hooks that start a run's agent, bind it and accept its return | `plugins/harness/scripts/actors.mjs` |
| capture | The plugin hook that records tool calls, agents and turns as rows | `plugins/harness/scripts/capture.mjs`, `plugins/harness/scripts/capture-rows.mjs` |
| release | A tagged build of the harness plugin, `harness-v<x.y.z>` | `scripts/release/release.mjs` |
| thread | A Hearth project thread: one piece of work, with its own session | `person.message`, `post.sent` |
| person | The human the work is for | `person.message`, `person.tap` |

## Observation

What the harness records, and how it is read back.

| Term | Means | Carried by |
|---|---|---|
| journal | The append-only record: one JSONL file per item or session under a journal root | `packages/journal/src/index.js`, `docs/journal.md` |
| row | One JSON line of the journal | `packages/journal/schema/row.schema.json` |
| kind | What a row records, from a fixed list | `packages/journal/src/kinds.js` `KINDS` |
| version | A row's format version `v`; older rows are upcast on read, never rewritten | `packages/journal/src/index.js` `VERSION`, `UPCASTERS` |
| blob | A stored text (a prompt, a brief, a result), kept once by its sha256 | `<journal root>/blobs/` |
| prompt.stored | The engine stored a run's prompt | `prompt.stored`, `packages/engine/src/actors.js` `prepare` |
| brief.stored | The engine stored one brief from a brief stage's result | `brief.stored`, `packages/engine/src/run/accept.js` `accept` |
| result.stored | The engine accepted a run's result | `result.stored`, `packages/engine/src/run/accept.js` `accept` |
| agent.prompt | Capture saw the prompt an Agent call gave a subagent | `agent.prompt`, `plugins/harness/scripts/capture-rows.mjs` |
| agent.final | Capture saw a subagent's final message | `agent.final`, `plugins/harness/scripts/capture-rows.mjs` |
| derived view | A number computed from rows, never stored back | `packages/journal/src/derive/`, `packages/journal/bin/derive.js` |
| inspector | The page that replays one item's journal on an engine checkout | `scripts/inspector/export.mjs`, `docs/inspector.md` |
| Observe page | The live page over the journal | `plugins/harness/pages/observe/data.js` |

## Where contexts meet

- **stage.** A plan stage (s0 to s6) and a model stage share the word. Write *plan stage* or *model stage* wherever
  the other could be meant; inside `packages/engine/` alone, *stage* is a model stage.
- **brief and prompt.** A brief is a brief stage's output. Every run, the brief stage's included, starts from a prompt.
- **item.** A plan item and an engine item are the same idea at two scales, so the word stays.
- **run.** In the engine a run is one model stage invocation. A CI run and the toy run belong to other contexts and
  are named with their qualifier.
- **actor.** In the engine an actor is anything a state invokes. The plugin's `actors.mjs` is the actor hooks, the
  platform side of the same runs.

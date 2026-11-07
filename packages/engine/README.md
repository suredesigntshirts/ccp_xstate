# engine

The engine loads a workflow file (`workflows/*.json` and its stage files) into XState and hosts one item of it at a
time. The host drives the item from what reaches it from outside, and carries out the effects each step asks for.

## Entry points

Everything below is exported from `src/index.js`.

**Workflows.**

- `loadWorkflow(name, { root, dir })` reads `<dir>/<name>.json` and its stage files and checks it. It returns the spec
  with id `<name>@<sha256>` and stores those bytes under `<root>/blobs`. A pinned name, `<name>@<sha256>`, reads the
  stored bytes and checks their hash, so an item always runs on the bytes it started on.
- `workflowOf(root, item)` is the pinned workflow an item started on, or null when it has not started.
- `readWorkflow(name, { dir })`, `compose(raw, { dir, name })`, `parseStageFile(text, { file, stage })`,
  `hasStageFiles(raw)`, `pinBytes(spec)` and `locationOf(spec, pointer)` (`src/prompts.js`) read stage files. A model
  stage's prose lives in `workflows/<workflow>/<stage>.md`; composing fills it into the spec, and `locationOf` says
  which file and line a piece of text came from.

**The machine, without a host** (`src/spec.js`, `src/schema.js`).

- `machineOf(spec)` is the XState machine. Actors never run in it: a host reads their start from the actions a pure
  transition returns.
- `startRefusal(spec, input)` says why an item cannot start with this input, or null.
- `hashOf(snapshot)` is the short hash of an item's state and context. `replay(spec, entries)` steps a journal of
  inputs by pure transitions and throws when an entry leads to another hash than it recorded.
- `get(root, path)`, `mapPaths(map, scope)` and `failing(spec, names, scope)` read paths and guards as the machine does.
- `check(schema, value)` checks a value against the JSON Schema subset the engine uses.

**The host** (`src/host.js`, `src/wake.js`, `src/tripwire.js`).

- `restore({ root, item, spec, session, release })` rebuilds the item from its one file and checks every recorded
  hash. `itemFile(root, item)` is that file; `sessionFile(root, session)` is a session's own file.
- `applyEvent(host, { event, source, run?, at? })` offers one event and returns its `engine.transition` row and the
  effects it asks for. `persist(host, rows)` appends rows. `runEffects(host, handlers)` carries out each effect once by
  its effect id. `offer(host, inputs, handlers)` does all three in turn.
- `pending(host)` is what the item waits on: effects not yet ended, and runs and timers still open.
- `OwnedError` is thrown when another session made the item's file between this host's restore and its first write.
- `inputsOfWake(host, text)` turns a wake the platform delivered into inputs. `wakesIn(text)` parses the wakes in a
  text, and `dueTimers(host, at)` lists the timers due by a time.
- `tripwiresOf(host)` is the tripwire rows in the item's file not yet offered, as `tripwire` events.

**Names** (`src/names.js`). How a run id is spelled and parsed (`runId`, `runOf`), how an id becomes a file name
(`safe`), where an item's, session's, run's, card's, agent's and spawn's files are under a journal root, and the
key-order-free hash of a returned result (`resultHash`). It imports only `node:` built-ins, so the plugin's return
tool and hooks and the inspector load this same file instead of keeping copies.

**Actors** (`src/actors.js`, `src/trace.js`).

- `actors({ host, repo, worktrees })` is the run handler for model stages: it prepares a run's prompt, folder and
  worktree.
- `accept({ root, caller, run, result, toolUseId, github })` checks an agent's returned result.
  `deliver({ root, run })` hands an accepted result to its item and prepares the runs its next state invokes.
- `resultsOf(host)` is the accepted results not yet offered to the item. `waiting(root, item)` is the runs prepared
  and not yet started, each with the Agent prompt to start it.
- `stageRecord(...)` and `producerOf(log, path, spec)` say what a stage was handed and who wrote each context value.

## Guarantees

- **One file per item.** An item's whole history is `<root>/items/<item>.jsonl`. Restore reads it by path, never by
  listing a folder, and refuses a file whose hashes don't replay.
- **One source per event.** `inputsOfWake` is the only place an event's source is read. It reads it from the wake's
  envelope or from the host's own record, never from a command line.
- **Each effect once.** `runEffects` carries out an effect once per effect id. An effect that started and never ended
  is not started again blindly: the handler's `find` asks the world whether it happened.
- **Only the owner acts.** The session that started an item owns it. Another session's host turns its events away as
  `not-owner` and runs none of its effects.
- **No shell in effects.** No effect handler runs a shell command. GitHub is reached over REST, and the thread and the
  clock through clients the caller hands in.

## Commands

`bin/host.js` runs the host from a shell or a hook, one item per call:

```
node packages/engine/bin/host.js start --item <id> --workflow quick-fix --input '<json>' --session <id>
node packages/engine/bin/host.js wake --item <id> --workflow quick-fix < <hook input JSON>
node packages/engine/bin/host.js show --item <id> --workflow quick-fix
node packages/engine/bin/host.js card --item <id> --workflow quick-fix --effect <ask run id> --ref <card id>
node packages/engine/bin/host.js closed --item <id> --workflow quick-fix --effect <ask run id>
node packages/engine/bin/host.js answer --item <id> --workflow quick-fix --effect <ask run id> --choice <c> --by <session> [--why <text>] [--grants <file>]
```

- `start` starts the item with its input, owned by `--session`.
- `wake` reads a Claude Code hook input on stdin (UserPromptSubmit, or PostToolUse of ReadNotifications) and offers
  the events its wake carries. The session is the hook input's `session_id`.
- `show` prints the item's state, `pending` and `waiting` without offering anything.
- `card` records which card the session put up for an ask run. `closed` records that the session withdrew it.
- `answer` is a stand-in's answer to an open ask (see Stand-in answers).

Every command but `show` also offers the results the return hook accepted and any tripwire rows. `start` and `wake`
take `--repo <git clone>` and `--worktrees <dir>` for the actors' worktrees. `--root` defaults to `$CCP_JOURNAL_DIR` or
`/mnt/project-files/harness/journal`. `CCP_GITHUB_API` points GitHub calls at another server, for tests.

## Effects

Every outside action an item takes is a host effect, with its handler from `src/effects/index.js`.
`handlers({ github, hearth, clock })` builds them.

| Effect | Made by | Does |
|---|---|---|
| `merge.js` | a run of the `merge` actor | merges `input.pr.url` over GitHub REST with `expectedHeadSha` = `input.sha` (the verdict's sha); a push after the verdict makes GitHub refuse it, the PR stays open and the item gets the actor's error |
| `card.js` | a run of the `ask` actor | puts up a decision card keyed by the effect id; the tap wake is the answer |
| `post.js` | a run of the `post` actor | posts `input.text` in the thread; the message id is the output |
| `timer.js` | a delayed transition | asks the clock for a wake at the due time; the host fires the timer from that wake |
| `item.js` | an invoke whose actor names a workflow | starts a child item whose id is the run's effect id; the child's output is the invoke's done event |
| `stop` (`index.js`) | a run whose state was left | an `ask` run's card is closed by its key (`hearth.close`), so nothing waits on the person; any other run's stop ends at once, and its late result is stale |

`github` (`src/effects/github.js`) reaches api.github.com through the session's proxy.

A command can't reach the thread or schedule a wake. So in `bin/host.js` posts stay pending and are printed, and a
timer effect ends at once with its due time. The open timer stays listed under `pending.timers`, and the session
schedules a wake for that time (send_later). The reminder arrives as a ReadNotifications notification with origin
`trigger_fire`. The host reads it as a wake with no body at the time it fired and never reads its text, so a reminder
can only fire timers already due.

Every state that asks the person sets a timer: a one-hour `checkBack` that moves nothing, so a quiet thread comes back
to the waiting item. The load check refuses an asking state without a timer.

Cards go through `src/effects/relay.js`. The session that has the thread's tools posts the card `show` lists and
records its id with `card`. That finishes the card effect as the item's owner, so the item's file names the card and
the tap wake on it answers the run. When the item leaves the state that asked, `show` lists the ask run's `stop` under
pending. The session withdraws the card (`close_decision` with no choice) and records that with `closed`, which
finishes the stop. `scripts/toy-run.sh` runs the whole loop; why: `plan/decisions/2026-10-30-engine-toy-run.md`.

The journal check (`packages/journal/bin/journal-check.js --repo <owner/name>`) lists every merge the host's merge
effect didn't make, and with `--host` fails on one.

## Tripwires

`derive.js rework --append items/<item>.jsonl` appends a `tripwire` row when a PR passes its item's round limit. The
host offers it on its next call as a `tripwire` event, once (`src/tripwire.js`). quick-fix steps back to replanning
from building, verifying or awaitingMerge when the event's PR is the item's.

## Stand-in answers

When the person is away, a stand-in session answers an open ask with `bin/host.js answer` (`src/standin.js`). The host
takes it only when the ask's card is up, the choice is one of the ask's choices, and an entry in the grants file
covers it. Otherwise it prints `refused: <why>`, exits 2, and leaves the item unchanged.

An accepted answer is the ask run's completion, `{ choice, by, grant }`, with source
`{ system: 'standin', ref: '<grant id> <card id>' }`. It is applied as the item's owner, so the host runs the merge
that follows as it would on a tap. Whichever of a tap and a stand-in answer comes first is applied; the other finds no
open run. The grants file defaults to `grants.json` beside the journal folder (`<harness>/grants.json`):

```json
{ "grants": [{ "id": "…", "workflow": "quick-fix", "ask": "ask", "choices": ["approve", "reject"],
  "repos": ["owner/repo"], "until": "<ISO time>", "granted_by": "…", "said": "the person's words", "said_at": "…" }] }
```

An entry covers an answer when its workflow and ask (the invoke id) match, it lists the choice and the card's repo,
and `until` is still ahead. The card's repo is its PR's when the card has a `pr` input. A card asked before any PR
(quick-fix's `blocked` card) takes the repo of the item's issue when that is a
`https://github.com/<owner>/<repo>/issues/<n>` URL. Otherwise the card has no repo, and no grant covers it, not even
one listing `null` in `repos`.

`--why <text>` adds a `why` to the answer's output, which quick-fix's replan needs. An answer the chart would not take
as given (a replan with no why) is refused before anything is written, so the same grant can answer the card again.
The person sets the file; the first one is `plan/decisions/2026-10-31-first-grant.md`.

## Actors

A state that invokes a model stage (`brief`, `build`, `verify`) starts an agent (`src/actors.js`). The run handler
writes the run's folder under `<root>/items/<item>/runs/<seq>.<invoke>/` and journals the prompt's hash (`prompt.md`, row `prompt.stored`). It adds a git
worktree named `<item>--<seq>.<invoke>` on branch `run/<item>/<seq>.<invoke>`, from `--repo`'s HEAD, under
`--worktrees`.

A rebuild, a run whose input `previous` is a PR ref, gets its worktree on that PR's branch at `previous.at` instead.
`accept` stamps the branch from GitHub's `head.ref` (not for a fork's PR). A missing commit is fetched from origin,
and a finished run's worktree holding the branch is detached first. With no stamped branch, or the head nowhere, the
run fails and its item steps back.

The run stays open until its agent returns:

1. The session calls the Agent tool with the prompt `ccp-run <run>`. `bin/host.js` prints it under `waiting`, and the
   harness hook names the waiting runs of the session's own items after each Agent call and wake (`ownedWaiting`).
   The harness's PreToolUse hook swaps in the run's prompt, so the agent starts with `prompt.md` exactly. A second start of a
   run is refused.
2. SubagentStart binds the agent to the run and tells it its run, worktree and result schema. Its shell commands run
   from the worktree, and file tools outside it are refused.
3. The agent calls the return tool (`mcp__plugin_ccp-harness_harness__return`, `{ run, result }`). Its PreToolUse hook
   refuses it unless the caller is the run's agent, the result matches the actor's schema and any claimed PR is on
   GitHub at the claimed head (`accept`). It then hands the result to the item (`deliver`), which prepares the next
   runs.
4. A refusal of the result (rules `schema`, `reserved`, `restated`, `covers`, `ref`) says how to fix it. Each output
   field its reason names comes with that field's own Output line, and a `restated` reason names every differing key
   with both values. The text ends `Refusal <n> of 10.` (`refusalText`). The tenth fails the run (`failed.json`, a
   `refusal-cap` row), and the item gets the actor's error event.
5. If the agent ends without its result accepted, by SubagentHandback (PreToolUse, `handback`) or a plain stop
   (SubagentStop, `stopped`), it is sent back once to call the return tool. The next time it ends, the run fails
   (`failed.json`, a `no-return` refusal row) and the item gets the actor's error event, so it steps back instead of
   waiting. A stop right after a handback fails at once, because a block does not bring that agent back.
6. If the session that owns the item ends a turn with the run prepared and no Agent call made, its Stop is blocked
   with the exact call (`stall`), at most twice per run. The stop after that fails the run (`failed.json` why
   `stalled: ...`, a `stall-cap` row), and the item gets the actor's error event. A session that cannot start the run
   calls the Agent tool with `ccp-cannot-start <run>: <why>` (`cannotStart`), which fails it with that reason. A
   failed run is not `waiting`, and `ccp-run` of it is refused. `derive.js stalls` counts how often this happens.

## Files

| Path | What |
|---|---|
| `<root>/items/<item>.jsonl` | the item's journal: every transition, effect and run row |
| `<root>/items/<item>/runs/<seq>.<invoke>/` | one run's prompt, context, result and failure |
| `<root>/items/<item>/cards/` | the records of cards put up and withdrawn |
| `<root>/blobs/<sha256>` | the pinned workflow bytes an item runs on |
| `<root>/sessions/<session>.jsonl` | what a session was refused for an item it does not own |
| `<root>/../grants.json` | the stand-in grants the person set |

The rows are in `docs/journal.md`, "Engine rows" and "Actor rows". Why the host and actors are shaped this way:
`plan/decisions/2026-10-30-engine-host.md` and `plan/decisions/2026-10-30-engine-actors.md`.

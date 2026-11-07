# Design books applied to the harness

**Date:** 2026-11-07
**Asked by:** the person, thread "Apply software design books to harness cleanup": review three concept summaries and
pull out the teachings worth applying to clean up the harness.
**Sources:** the person's concept summaries, read in full through the Claude Docs connector:
*The Pragmatic Programmer* (Thomas and Hunt, 2019, https://claude.ai/artifact/E8hb6RFC3DYpSdoQvTLLYN),
*A Philosophy of Software Design* (Ousterhout, 2nd ed. 2021, https://claude.ai/artifact/33pqr9r7ovL2Se1AEfVM7G),
and *Ubiquitous Language & Domain-Driven Design* (Fowler's bliki entries and Evans 2003,
https://claude.ai/artifact/3zUbKsMUTpkvy7jDjfeQ4N). The code was read at `main` 02a7e2c (harness-v0.1.33).
**Status:** research only. Nothing here is built. The follow-up items are `draft` in `plan/items/`.

## The short version

The harness's process is already in good shape. It has a verifier gate, one history, design tournaments ("design it
twice") and the message catalogue (one source for every word a model sees). The problems are in the code that grew
during the 11-05 fix run. Since 11-04, 76 of 148 commits on `main` name a `fix-` item. Most of those fixes added a
rule, a cap or a special case to `packages/engine/src/actors.js`, and none of them stepped back to change the model.
Ousterhout calls this tactical programming, and the Pragmatic Programmer calls it software entropy. The ledger
already holds the matching lessons: `L-count-concepts` and `L-rules-in-spec-not-host`.

Ranked by value for the effort, the six changes worth making are:

| # | Teaching | Smell in the harness | Change | Value | Effort |
|---|---|---|---|---|---|
| 1 | Ubiquitous language, one word per concept within a context (DDD) | `brief`, `actor`, `stage` and `brief.stored` each mean two or three things | `docs/language.md`, then rename the collisions | High | S, then M |
| 2 | Comments say what isn't obvious; interface docs don't carry history (APOSD 12, 13) | About 50 plan-item and tournament-round references in source comments; the engine README reads like a changelog | Present-tense comments only; item ids stay in commits and the plan | Med | S |
| 3 | DRY is about knowledge, not text (PragProg) | The run-folder naming and the result hash are copied across processes "since it may not import the engine" | One dependency-free module that both sides load | Med | S |
| 4 | Make implicit concepts explicit (DDD); define errors out of existence (APOSD 10) | A run's lifecycle is the set of files that happen to exist, checked separately by eight hook functions with three different caps | One run store with explicit states and a single budget for a run that isn't delivering | High | M |
| 5 | Keep general and special-purpose code apart (APOSD 6); rules belong in the spec (ledger) | The generic engine knows the actor named `brief`, the meaning of PASS/FAIL, and GitHub PR gate policy | The stage contract declares these; ref kinds get their own checkers | High | M |
| 6 | Information hiding: the same decision shouldn't live in two modules (APOSD 5) | The inspector rebuilds graph matching and scans JS string literals to guess what the engine already records | The inspector reads the engine's records and `chart()`; legacy guessing is dropped | High | M–L |

Two more need a decision before they're built:

- **Drop the pinned-before-X compatibility branches (7).** Value: Med. Effort: S. It needs a cutoff (decision record).
- **Add a fix budget to the plan (8).** The third fix in one module starts a redesign item. Value: High over time.
  Effort: S. It's a process change in plan/README.

## 1. One language, one meaning per word

**Teaching.** In DDD, a ubiquitous language is scoped to a bounded context. Within that context each word means one
thing, and each thing has one word. When a word changes, the model changes, and the change flows through to the code,
tests and docs ("language change equals model change"). Fowler's failure modes include *code drifting from talk* and
*overloaded tech terms*. The harness has both, and it pays for them twice: the person reads the inspector in these
words, and every agent session reads the code in them.

**Collisions found:**

| Word | Meanings today | Where |
|---|---|---|
| `brief` | (a) a model stage in three workflows (`workflows/quick-fix.json:14`, actor `brief`); (b) any run's rendered prompt, `runs/<n>/brief.md` (`actors.js:261`, "file name kept"); (c) the brief stage's output, the per-role briefs | `actors.js:604-609` |
| `brief.stored` row | (a) the engine stored a run's prompt (`actors.js:264`, payload `run, actor, role`); (b) the engine stored one role's brief from a brief stage's result (`actors.js:608`); (c) the capture hook saw an Agent prompt (`plugins/harness/scripts/capture-rows.mjs:250`, payload `agentId`) | the inspector needs a comment to tell (c) from (a) (`scripts/inspector/export.mjs:744`) |
| `result.stored` row | (a) the host accepted a result (`actors.js:598`); (b) the capture hook hashed an agent's final message (`capture-rows.mjs:354`) | same comment |
| `actor` | (a) any XState invoke src, including host effects and child workflows; (b) "the actors that are agents are the workflow's model stages" (`actors.js:24`); (c) the plugin's hook file `actors.mjs` | `stages.js`, `effects/index.js` |
| `stage` | (a) a plan stage, s0–s6 (`plan/stages/`); (b) a model stage, an agent step in a workflow (`stages.js`) | both appear in the same PRs |
| `prompt` vs `brief` | synonyms for the text an agent starts with | `prompts.js` vs `brief.md` and `briefHash` |

`item` looks overloaded, because it's both a plan item and an engine item, but it isn't. Both are one piece of work
carried through a workflow, and the plan says v2 will take its real work items from the plan. Keep `item`. A run is
also fine within the engine context. "Toy run" and "CI run" belong to other contexts.

**Change.** Write `docs/language.md`, with the glossary split by context: plan, engine, platform (Claude Code and the
Hearth thread) and observation (journal and inspector). Each term gets one line that names the code that carries it.
Then rename where it pays:

- `brief.md` → `prompt.md`, and the engine's prompt row → `prompt.stored`. `brief` then means only the brief stage
  and what it writes.
- The capture hook's rows get their own kinds (`agent.prompt`, `agent.final`). They're a different writer with a
  different meaning (`L-record-route-at-write`). This is a journal version bump (`L-version-event-schema`).
- In code and docs, the engine says *model stage* only where *stage* could be read as a plan stage. A better word
  for the engine side (*step*) can come later, once the glossary has been used for a while.

The evidence for this ranking is that the inspector already carries comments that translate between these meanings.
That's the *translator bottleneck* failure mode.

## 2. Comments state what's true now

**Teaching.** In APOSD, a comment should describe what the code can't. Interface comments say what a caller needs
and leave the history out ("implementation documentation contaminates interface"). Pragmatic adds that knowledge
should live in one place. In this repo, the why of a change lives in its plan item (CLAUDE.md, "the why travels with
the work"), and `git log` plus the item's id find it.

**Smell.** About 50 `(plan item …)` and `(fix-…)` references sit in source comments under `packages/engine/src`,
`plugins/harness/scripts` and `scripts/inspector`. Some comments narrate history:

- "judge's round-1 graft from lane A" (`actors.js:558`)
- "round 2, graft from lane B" (`actors.js:560`)
- "Design A, 4.1" (`actors.js:519`)
- "as before stage-prompt-files" (`index.js:47`)

`packages/engine/README.md` explains each behaviour by the fix that added it, and some of its sentences run past
100 words. That makes the code read as an archive. Every session that opens these files pays tokens for history it
can't use.

**Change.** Add a rule to `docs/layout.md`: comments are present tense and say what holds and why it must hold. Item
ids go in the commit, the PR and the plan. Then sweep once. A comment like "(fix-rebuild-worktree)" becomes the
invariant it protects, or is deleted if the code already says it. Rewrite the engine README as an interface
description: entry points, guarantees and files. The per-fix narrative already lives in `plan/items/`.

## 3. Knowledge in one place, not text in one place

**Teaching.** In the Pragmatic Programmer, DRY is about knowledge. Two copies of a one-line helper are harmless. Two
copies of a protocol that must agree are a bug waiting for an edit.

**Smell.** These copies must agree:

- The result hash protocol: `sorted` and `sentHash` in `actors.js:38-39`, copied in
  `plugins/harness/scripts/return-tool.mjs:32-35`. The copy's comment says the tool "may not import the engine", but
  it already loads `messages.js` from the engine through `host.mjs`'s `engine()` loader.
- The run-folder naming, `safe()` with the run-id regex: `actors.js:43,47`, `effects/relay.js:11`, `return-tool.mjs:36-40`
  and `scripts/inspector/export.mjs:22`.
- The item file path: `itemFile` in `host.js:30` and again in `actors.js:55`.

**Change.** Add `packages/engine/src/runs/names.js`, with no dependencies: run id parsing, run and item paths, and the
canonical result hash. The engine, the return tool (through `engine()`) and the inspector all import it. The
`readJson`, `writeJson` and `isObject` one-liners can stay where they are. They encode no shared decision.

## 4. Make the run lifecycle an explicit model

**Teaching.** DDD says to make an implicit concept explicit when the code keeps working around it. APOSD says to
define errors out of existence and to pull complexity down. When every caller has to handle a special case, give
the case one owner, or shape the semantics so it doesn't come up.

**Smell.** A run has a lifecycle (prepared → spawned → bound → returned, or failed) in a project built on state
machines. The lifecycle is stored only as which files exist in its folder: `run.json`, `spawn.json`, `agent.json`,
`result.json`, `failed.json` and `stage.json`. Eight exported functions check that existence separately, each with
its own refusal:

- `spawn`: `spawn-already-failed`, `spawn-already-started`, `spawn-started-elsewhere` (`actors.js:282-295`)
- `accept`: `wrong-caller` ×3, `already-returned`, `already-failed` with two variants (`actors.js:505-514`)
- `bind`, `bindLate`, `handback`, `stopped`, `stall` and `cannotStart` (`actors.js:322-360, 690-716, 858-900`)

There are three separate budgets for "the agent isn't delivering":

- `REFUSAL_CAP = 10` for refused results (`actors.js:443`)
- one send-back on handback or stop (`actors.js:659-716`)
- `STALL_CAP = 2` for a session that doesn't start the agent (`actors.js:797`)

Each budget came from its own fix item: fix-refusal-hints, engine-actor-returns and fix-waiting-run-stall. The
journal has to be read to recover each count (`resultRefusals`, the stall rows).

**Change.** Add one run store, `runs/store.js`, owning a run's folder. It exposes
`state(run) → prepared | spawned | bound | returned | failed`, plus `transition(run, event)`, which writes the file
and the journal row together. Every hook asks it, and every "already X" refusal becomes one message,
"run is <state>: <what to do>", from one catalogue entry. Merge the three budgets into one attempt budget per run.
It counts refusals, send-backs and stalls, and the run fails when the budget is spent with one reason. The run's own
`run.json` records the count, so nothing has to re-read the journal. This is the module the 11-05 fixes kept
patching. Giving the lifecycle a name makes the next fix one change in one place.

Done together with this, split `actors.js` (900 lines) by what each part knows instead of by hook order:

- the run store above
- `worktree.js`: `rebuildStart`, `freeBranch`, `githubOf`, and the worktree add in `prepare`
- `accept.js`: the result checks
- `supervise.js`: handback, stop, stall and cannot-start

Today the file follows the order hooks fire in, which APOSD calls temporal decomposition. Claude Code's terms
(`agentId`, `toolUseId`, `transcript_path`, `meta.json`) stay in `plugins/harness/scripts/actors.mjs`, which
translates them. That plugin script is the anticorruption layer between the platform context and the engine
context.

## 5. Keep workflow rules out of the generic engine

**Teaching.** APOSD says to keep general-purpose mechanisms free of special-purpose knowledge (the red flag is
"special-general mixture"). The ledger already says the same for this project: `L-rules-in-spec-not-host`, "Rules
belong in the machine JSON, read by a fixed interpreter."

**Smell.** The engine's result acceptance and load check know three things that belong to particular workflows:

- **The actor named `brief`.** `if (run.actor === 'brief')` stores each string field of the result as a role's
  brief (`actors.js:604`). A workflow whose brief stage has another name loses this silently.
- **What a verdict is.** The load check and `coverGap` find a verdict by looking for an enum whose values are the
  words PASS or FAIL in any case (`stages.js:314-331`, `WORD`, `verdictAt`, `mayHoldLines`). The coverage rule
  depends on that guess.
- **GitHub PR policy.** Inside `accept`, a ref whose url is a PR gets `key`, `branch`, `checkout`, `gates` (files
  under `.github/`) and `green` (all check suites green) stamped (`actors.js:534-576`; `STAMPED` and `HIDDEN` in
  `stages.js:50-52`). Any other url must contain `at` in its page body (`actors.js:578-587`). Those are two ref kinds
  with different rules, both inside one 140-line function.

**Change.**

- The stage contract declares these instead of the engine guessing. An output field marked as a verdict
  (`"x-verdict": true`), an output part marked as briefs to store (`"x-store": "brief"`), and refs typed by kind
  (`"x-ref": "github-pr" | "web-page"`).
- Each ref kind becomes a checker module under `effects/refs/` that returns its stamped fields. `STAMPED` is then
  the union the checkers declare.
- `accept` keeps the order of checks and loses the policy.

This shortens `accept` and the load check. It also lets the inspector show the reader why a field is a verdict,
which serves the person's core need of seeing each stage's contract.

## 6. The inspector reads records, it doesn't reconstruct them

**Teaching.** APOSD's information leakage: when the same design decision is reflected in two modules, a change to
one silently breaks the other. Pragmatic's "plain text, single source of truth" points the same way. So does the
ledger's `L-facts-from-source`.

**Smell.** `scripts/inspector/export.mjs` is 1,282 lines, the largest file in the harness. Much of it re-derives what
the engine decides:

- Graph edges and transition matching from the workflow JSON (`export.mjs:24-200`). This sits beside the engine's
  own `chart()` (`stages.js:153`) and `failing()` (`spec.js:69`).
- "Which text is literally the engine's: the static pieces of its string literals" (`export.mjs:334-503`). It
  guesses provenance by scanning engine source, even though `stage.json` now records every prompt piece with its
  catalogue entry (prompt-catalogue, inspector-catalogue-entries).
- "An actor is a model when its run has a folder with brief.md" (`export.mjs:5`). The run record says this outright.

Each of these breaks quietly when the engine changes. The inspector is how the person sees what each stage was
given, produced and passed on. It should be the most trustworthy part of the harness, not the most inferential.

**Change.** The engine exports what the inspector needs, in one function: `explain(spec, snapshot, event)` returns
the transitions tried, with their guards and needs, built on `chart()` and `failing()`. The exporter reads
`stage.json` and `run.json` as the record, deletes the literal scanning and the brief.md inference, and stops
supporting runs recorded before `stage.json`. Nothing that old is in use, and the person said nothing is live yet,
so big swings are fine (11-04). This depends on 7 for the cutoff and on 1 for the row-kind split.

## 7. Drop the compatibility branches (needs a cutoff)

**Teaching.** In APOSD, complexity is incremental: each "keep the old behaviour for items pinned before X" branch is
small, and together they're most of the reading cost. Pragmatic says not to live with broken windows.

**Smell.**

- `index.js:71`: "An item pinned before fix-waiting-wake keeps its asking states with no timer".
- `checkStages({ pinned: true })` relaxes the load check for old pins.
- `prompts.js` and `index.js:47`: two pin formats, "as before stage-prompt-files".
- The `stages.js:531` error about workflows pinned before the stage contract.
- The inspector's pre-catalogue and pre-`stage.json` paths.

**Change.** Record a cutoff decision: every engine item in the project journal is finished or dropped, and an item
pinned to an older format is refused with "finish it on the release that started it". Then delete the branches. This
is a two-way door for this repo, but it touches the shared journal folder, so the decision goes in
`plan/decisions/`.

## 8. A fix budget: when to step back (process)

**Teaching.** APOSD's strategic programming says to spend about 10–20% on design continuously, not after the mess.
Pragmatic's broken windows, and DDD's refactoring toward deeper insight, say the same thing: when the model keeps
needing patches, the model is wrong. CLAUDE.md already says "step back, don't grind", but that only counts rounds
within one item. Nothing counts fixes across items to the same module. The 11-05 run made eight `fix-` items, and
five of them changed `packages/engine/src/actors.js` (their `outputs`), before anyone looked at the shape.

**Change.** Add a rule to `plan/README.md`: a `fix-` item names the module it changes. When a third fix item in 14
days names the same module, the next item there is a `replan/` design item instead. That item names the concept that
keeps breaking and designs it twice, which the tournament kit already supports. `L-count-concepts` gives each fix a
concept delta to report.

## Considered, not adopted

- **DDD's tactical building blocks as classes** (entities, value objects, repositories, aggregates). The engine is
  data plus functions over a journal, and XState is the model. Wrapping that in classes would add a layer with the
  same abstraction as the one below it (APOSD 7, "different layer, different abstraction"). Adopting the language and
  the explicit concepts gets the benefit without the ceremony.
- **A blanket DRY sweep of one-line helpers.** These encode no shared decision, and a shared util package would be
  a shallow module everyone depends on. Only shared knowledge moves (finding 3).
- **Writing comments first for all new code** (APOSD 15). It's useful, but the stage contract and the plan item
  already play that role for the parts that matter. Finding 2's rule covers the rest.
- **Tracer bullets, prototypes and "design it twice"** are already practice here: the toy run, the probes and the
  tournaments. Nothing to add.
- **A context map between the harness and v1** (DDD strategic design). v1 is being retired (s6). A map would document
  something about to disappear.

## Proposed items (draft)

Build order: 2 and 3 first, as small cleanups that make the rest cheaper to read. Then 1 (the glossary first, the
renames once 4 and 5 settle the names), then 4, then 5, then 7, then 6. Item 8 is a plan rule and can be adopted at
any time.

| Item | Finding | Kind |
|---|---|---|
| `comments-present-tense` | 2 | build |
| `run-names-one-module` | 3 | build |
| `harness-glossary` | 1 | build |
| `run-lifecycle-store` | 4 | build |
| `stage-contract-declares-rules` | 5 | build |
| `retire-pinned-legacy` | 7 | build (with a decision) |
| `inspector-reads-records` | 6 | build |
| `fix-budget-rule` | 8 | decision |

Each is `draft` in `plan/items/`, in stage s5-parity. That stage's `measured` gate compares concept counts with v1,
so cleanup that lowers the count serves it directly.

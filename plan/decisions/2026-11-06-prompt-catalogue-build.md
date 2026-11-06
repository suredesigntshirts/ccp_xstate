# Prompt catalogue: the builder's choices (2026-11-06)

Two-way doors decided while building plan item prompt-catalogue, beside the design in
`plan/decisions/2026-11-06-prompt-catalogue.md`.

## The named runtime dependencies

The rule that replaces "nothing but xstate": a workspace may depend at runtime on a package that a file here names on a
line of its own, which `test/workspaces.test.mjs` reads. A mention in prose does not count, so naming one is deliberate.

Runtime dependency: `xstate`

Chosen in `plan/decisions/2026-10-30-wf-quick-fix.md`: the engine steps workflows with it.

Runtime dependency: `mustache`

Chosen in `plan/decisions/2026-11-06-prompt-catalogue.md`: it renders the message catalogue. Pinned at 4.2.0.

## How the hooks get mustache

The installed plugin is a copy of a release extracted from git (`infra/cloud-environment/setup.sh`): it has no
`node_modules`, and the clone it comes from has none at setup time either. So `packages/engine/src/messages.js` imports
`./vendor/mustache.mjs`, the package's own `mustache.mjs` copied byte for byte (its licence beside it), which rides
along with the engine source into `lib/engine/src`. The npm dependency stays declared and locked, and
`packages/engine/test/messages.test.js` fails when the copy differs from `node_modules/mustache/mustache.mjs`, so the
copy can't drift from the version the lockfile names. Considered: `npm ci` in setup (needs the network, and the setup
tests run without it) and copying `node_modules` (absent at setup).

## The file format

The design fixed `## <name>` headings with the template after. Templates such as the part headings (`## Rules`) begin
with `## ` themselves, so each template sits between two lines of exactly three backticks, which also keeps its blank
lines and trailing text exact. Between the heading and the fence an entry may have note lines saying when it is sent
and what its slots hold; they are for the reader and never rendered. `messages.md` lives at `packages/engine/`, beside
`src/`, as the item named it; setup.sh copies it to `lib/engine/messages.md` and `scripts/release/release.mjs` lists
it as released.

## What is an entry and what is a value

- An entry is every sentence and every fixed fragment: the prompt frame (headings, the data and worktree rules, the
  `- rule`, `- name: meaning` / `= value`, `- field: description` and `Schema:` lines, `(none)`, the return line), the
  run line, the return tool's description, argument descriptions and answers, every deny, block and added context of
  the hooks, and the reasons a refusal, a send-back, a stall or a cannot-start records. Also the self-check sentences
  of a passed check, which are journalled but not shown, so all of selfcheck.mjs reads alike.
- Two wordings are two entries: `no-return` and `no-return-after-handback`, the five shapes of a refused return
  (`refusal`, `refusal-counted`, `refusal-counted-hints`, `refusal-last`, `refusal-last-hints`, plus `refusal-failed`,
  which accept() never reaches but refusalText still answers).
- A slot may hold another entry's render (`bound` holds the run line, `sent-back-handback` the return line) or a list of
  renders joined by a separator its note names (`waiting`, `refusal-cap`, `check-files-fail`, `restated`). Partials
  would say this inside the template; the design refuses them so that a template is text and slots only.
- Values: ids, paths, URLs, shas, JSON of inputs, a workflow's own words (rules, meanings, descriptions), a validator's
  problems (`schema.js` check(), shared with load and event checks, which are not model-facing), and a placeholder
  for a missing value (`unknown`, `none`, `unset (1)`, `unreadable`).
- Left where they are, as the design says: journal-only reasons of the host, errors for workflow authors, text for the
  person, and the item error `<actor> blocked: <reason>` a workflow reads. Also `install.mjs`'s one line, which the
  install skill prints for the session that ran it, like the host command's output.
- One literal remains: the line `session-start.mjs` says when the catalogue itself cannot be loaded, since nothing can
  render it then. It is new text, said only in that case; every other line of that hook is an entry, and it loads the
  catalogue first, from its own path, so a copy missing any other file still renders its line.

## Values are text or numbers

A render refuses `null`, `undefined`, objects and arrays: mustache would print `null` as nothing, where the template
literals printed `null`, so a silent change of wording is refused instead. The code passes `String(x)` where the old
literal printed a value that may be absent, so the bytes stay what they were.

## Loading the catalogue outside the actor hook

`verify/engine-host/plugin-tools.test.mjs` (done) holds that the return tool imports no engine code and that only the
actor hook loads the engine. messages.js is engine source only by where it lives: it imports nothing of the engine
but its vendored mustache. host.mjs's `messages()` loads it for the return tool, the self-check and the release notice,
which run no engine logic; the actor hook gets its words through actors.js.

## What is recorded

- A refusal row the engine writes (a refused return, the refusal cap, a send-back, a no-return, a stall, a stall cap,
  a cannot-start) carries `payload.message: { entry, slots }` beside `reason`; rendering the entry with the slots gives
  `reason`. `textHash` is unchanged.
- stage.json: every prompt piece rendered from an entry carries `source.entry`, the fixed frame pieces included; the
  run context's source too. `frame`, `fixed` and `filled` stay as they were, so the Inspector and done verifier tests
  read them unchanged.

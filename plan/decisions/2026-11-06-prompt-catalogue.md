# Prompt catalogue: format, renderer and the dependency rule (2026-11-06)

Claude's two-way-door decisions as architecture lead, made when the person asked (thread "Update harness artifacts to
current release", 6 Nov) how much prose is hard-wired in code, whether it hides the logic, which templating language
fits, and asked to drop the zero-dependency rule.

## What is model-facing

Text a model reads: the fixed frame of every stage prompt (`DATA_RULE`, `WORKTREE_RULE`, `returnLine`, `runLine`,
headings), the return tool's description, every PreToolUse deny reason, every Stop and SubagentStop block reason, and
every `additionalContext`. Not model-facing: journal error reasons from the host, load-check errors for workflow
authors, and text for the person (cards, posts).

## Format

- One file, `packages/engine/messages.md`. Each entry is a `## <name>` heading (kebab-case, for example
  `refusal-wrong-head`) followed by its template, as written. One file, so a reader sees every sentence in one place.
- Slots are `{{name}}` only. No sections, inverted sections, partials, comments or helpers. Two wordings are two
  entries and the code picks one, so the catalogue alone lists every sentence a model can get.

## Renderer

- mustache.js, behind `packages/engine/src/messages.js`. Logic-less, a published spec, no dependencies of its own, and
  `Mustache.parse()` lists a template's tags, which the wrapper uses to be strict: refuse a missing value, an extra
  value, and any tag but a plain variable. HTML escaping is off (prompts are not HTML).
- Considered: our own 30-line `{{slot}}` renderer (fine, but the spec and parser come free), Handlebars, Jinja-style
  (Nunjucks, Liquid) and prompt formats (POML, Prompty): each puts logic or structure into templates that the stage
  files and the code already own.

## Dependency rule

The zero-runtime-dependency rule is replaced: a runtime dependency is allowed when a file in `plan/decisions/` names
it. Named so far: `xstate` (`plan/decisions/2026-10-30-wf-quick-fix.md`) and `mustache` (this file). Why keep a
record: each dependency runs inside every thread's hooks, so it is chosen on purpose, not by drift.

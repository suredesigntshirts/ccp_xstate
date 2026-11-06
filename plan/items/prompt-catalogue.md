```json
{
  "id": "prompt-catalogue",
  "title": "Keep every sentence the harness sends a model in one catalogue of named templates",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "Every piece of text the engine or the harness plugin sends to a model, outside the stage files, is a named entry in one catalogue file of logic-less {{slot}} templates, rendered through mustache.js behind a strict wrapper. That covers the fixed prompt parts (data rule, worktree rule, return line, run line, headings), the return tool's description, and every situational message (refusals, worktree denials, send-backs, the stall block, cannot-start, the bound and waiting lines, the session-start and release notices). Each message that is sent is recorded with its entry name and slot values. The rule against runtime dependencies is replaced by one that needs a decision record for each.",
  "why": "On 6 Nov the person asked how much prose is hard-wired in code and whether it makes the prompts hard to trace. It does. About 150 words of every stage prompt and about 20 situational messages are JavaScript template literals spread over packages/engine/src/stages.js, packages/engine/src/actors.js and plugins/harness/scripts/. A reader can see a filled message in the journal but cannot list every sentence a model can receive, review them side by side, or tell which words were values. stage-prompt-files gave stage prose one home; this does the same for the harness's own prose, so the core need (see each stage's instructions, inputs and outputs, and how they flow) holds for text the harness injects mid-conversation too. Templates stay logic-less: two wordings are two entries and the code picks one, so the catalogue alone shows every sentence. The person also asked to drop the zero-dependency rule; mustache.js (logic-less, a published spec, no dependencies of its own) is the first dependency taken under the new rule. Decided in plan/decisions/2026-11-06-prompt-catalogue.md.",
  "serves": [
    "L-theory-written",
    "L-rules-in-spec-not-host",
    "L-stage-needs-bench"
  ],
  "depends_on": [
    "stage-prompt-files"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/stages.js",
      "what": "DATA_RULE (line 29), WORKTREE_RULE (32), returnLine (33), runLine (35), HEADINGS and the '(none)' frame, used by sections()"
    },
    {
      "ref": "packages/engine/src/actors.js",
      "what": "Refusal reasons of accept() and spawn(), confine() denials, the refusal-cap line, sentBack() and the no-return text, stallText(), cannotStart() replies"
    },
    {
      "ref": "plugins/harness/scripts/actors.mjs, return-tool.mjs, session-start.mjs, notice-behind.mjs",
      "what": "The bound and waiting-runs lines, the return tool's description, the self-check and newer-release notices"
    },
    {
      "ref": "test/workspaces.test.mjs, CLAUDE.md, docs/layout.md",
      "what": "The zero-runtime-dependency rule and the test that enforces it (workspaces.test.mjs line 25)"
    },
    {
      "ref": "plan/decisions/2026-11-06-prompt-catalogue.md",
      "what": "The catalogue format, the strict wrapper, the dependency rule, and what counts as model-facing"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/messages.md",
      "what": "The catalogue: one entry per message, a '## <name>' heading then its template; slots are {{name}} only"
    },
    {
      "ref": "packages/engine/src/messages.js",
      "what": "Loads the catalogue, refuses a malformed one, and renders an entry through mustache.js with HTML escaping off, refusing a missing or unknown slot and any section, partial or comment tag"
    },
    {
      "ref": "packages/engine/src/stages.js, actors.js and the plugin scripts",
      "what": "Every model-facing text comes from a catalogue entry; the code chooses the entry and supplies values only"
    },
    {
      "ref": "journal rows and stage.json",
      "what": "Refusal, sent-back, no-return, stall and cannot-start rows carry the entry name and slot values beside the text; stage.json names the entry for each fixed frame piece"
    },
    {
      "ref": "test/workspaces.test.mjs, CLAUDE.md, docs/layout.md",
      "what": "A runtime dependency is allowed when plan/decisions/ names it; xstate and mustache are named"
    },
    {
      "ref": "docs/prompts.md",
      "what": "Where each piece of model-facing text comes from, now including the catalogue, and how to edit an entry"
    }
  ],
  "expect": [
    {
      "id": "catalogue",
      "check": "Every text that the engine or plugin hands a model (prompt frame parts, the return tool's description, PreToolUse deny reasons, Stop and SubagentStop block reasons, additionalContext) is rendered from an entry of packages/engine/messages.md: running the engine, plugin and verify test suites with the renderer instrumented, every such hook output and every rendered brief.md frame piece equals a render of a named entry",
      "how": "The verifier instruments the hook outputs and the renderer in a scratch copy and runs the suites",
      "proof": "verifier"
    },
    {
      "id": "same-text",
      "check": "For the same values, every prompt and every message is byte for byte what main gave before this item: render() on every committed run folder still gives its brief.md, and each catalogue entry with sample values equals the old template literal",
      "how": "The verifier's own test comparing against the base commit",
      "proof": "verifier"
    },
    {
      "id": "strict",
      "check": "A render with a missing slot value, an extra value no slot names, or a template using a section, inverted section, partial or comment tag is refused naming the entry; a malformed catalogue (duplicate name, empty entry) is refused at load naming the line; a value containing < or & is not HTML-escaped",
      "how": "The verifier's own malformed entries and values",
      "proof": "verifier"
    },
    {
      "id": "recorded",
      "check": "In a scripted run that hits a refusal, a send-back and a stall, each journal row carries the entry name and slot values, and rendering that entry with those values gives the row's text",
      "how": "The verifier drives a run with the host and reads the rows",
      "proof": "verifier"
    },
    {
      "id": "deps",
      "check": "test/workspaces.test.mjs fails a workspace whose runtime dependency no plan/decisions/ file names and passes with xstate and mustache; CLAUDE.md and docs/layout.md state the new rule",
      "how": "The verifier adds an unnamed dependency in a scratch copy and runs the test",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [
      "message catalogue: the named templates of every model-facing text outside the stage files"
    ],
    "budget": 1
  },
  "non_goals": [
    "No change to any wording: every prompt and message stays byte for byte the same (rewording comes later, measured on the bench)",
    "No logic in templates: no sections, partials or helpers",
    "No change to the stage files or their format",
    "Text for the person (cards, posts) and errors for workflow authors (load checks) stay where they are"
  ],
  "records": [
    "entry name and slot values on every recorded model-facing message",
    "the catalogue entry named on each fixed frame piece in stage.json"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

The stage files hold what each stage is told. This item gives the harness's own words the same home: the fixed frame of
every prompt and the messages a model gets mid-conversation as a tool result, a blocked stop or added context. The
format, the wrapper and the dependency rule are in `plan/decisions/2026-11-06-prompt-catalogue.md`. A done item's
verifier test that compares a message literal may be changed only to compare the rendered entry, checking the same
outcome. A plugin change ships as a release.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under
`verify/prompt-catalogue/` without reading the builder's. For catalogue, wrap the renderer and the hook output in a
scratch copy and run `npm test`, then match every model-facing output to an entry. For same-text, render from the base
commit and the head with the same values. For strict and deps, write the malformed inputs yourself. For recorded, drive
one scripted quick-fix run through a refusal, a send-back and a stall. Read the ci check at the head sha. Commit
`verify/prompt-catalogue/verdict.json` with a verdict per Expect id.

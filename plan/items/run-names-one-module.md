```json
{
  "id": "run-names-one-module",
  "title": "Keep run naming and the result hash in one module every process loads",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "One engine module, packages/engine/src/names.js, importing only node: built-ins, holds the run id format and its parser, the safe file-name rule, the item, run, card and agent paths under a journal root, and the canonical result hash. actors.js, host.js, effects/relay.js, plugins/harness/scripts/return-tool.mjs (through host.mjs engine()) and scripts/inspector/export.mjs import it and keep no copy, and behaviour is unchanged.",
  "why": "These are protocols two processes must agree on, not helpers: the return tool's MCP server matches the hook's stored result by a hash of the result with keys sorted, and four files each turn a run id into a folder with their own regex and safe(). A change to one copy breaks the others silently. return-tool.mjs keeps its copy because it \"may not import the engine\", but it already loads the engine's messages.js through host.mjs. Pragmatic DRY is about knowledge; research plan/research/design-books-cleanup.md, finding 3.",
  "serves": [
    "L-count-concepts"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "plan/research/design-books-cleanup.md",
      "what": "Finding 3: the copies with file and line"
    },
    {
      "ref": "packages/engine/src/actors.js",
      "what": "runOf (line 42), safe (47), runDir (49), agentFile and spawnFile (53-54), itemFile (55), sorted and sentHash (38-39)"
    },
    {
      "ref": "packages/engine/src/host.js",
      "what": "itemFile and sessionFile (30-32)"
    },
    {
      "ref": "packages/engine/src/effects/relay.js",
      "what": "safe (11) and the run id regex in cardFile (14-17)"
    },
    {
      "ref": "plugins/harness/scripts/return-tool.mjs",
      "what": "sha256, sorted, sentHash, safe and the run id regex (32-40); loads messages through host.mjs"
    },
    {
      "ref": "plugins/harness/scripts/host.mjs engine()",
      "what": "Loads an engine source file from lib/engine/src (installed), the repo, or the clone"
    },
    {
      "ref": "scripts/inspector/export.mjs",
      "what": "safe (22) used for item, run and card folders"
    },
    {
      "ref": "infra/cloud-environment/setup.sh",
      "what": "Bundles all of packages/engine/src at lib/engine/src, so a new file there ships with the plugin"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/src/names.js",
      "what": "runId parse and format, safe, itemFile, sessionFile, runDir, cardFile, agentFile, spawnFile, resultHash; node: imports only"
    },
    {
      "ref": "packages/engine/src/actors.js, host.js, effects/relay.js",
      "what": "Import from names.js; host.js keeps exporting itemFile and sessionFile by re-export so callers are unchanged"
    },
    {
      "ref": "plugins/harness/scripts/return-tool.mjs",
      "what": "Loads names.js through engine() and drops its copies"
    },
    {
      "ref": "scripts/inspector/export.mjs",
      "what": "Imports safe and the path helpers from the engine checkout it already loads, falling back to the repo's own names.js"
    },
    {
      "ref": "packages/engine/test/names.test.js",
      "what": "The builder's test of each name and of the hash being key-order independent"
    }
  ],
  "expect": [
    {
      "id": "one-place",
      "check": "At the head, outside packages/engine/src/names.js, tests and vendor/, no file under packages/, plugins/ or scripts/ holds the run id pattern ':(\\d+\\.[\\w-]+)$', the safe pattern '[^A-Za-z0-9._-]', or a sorted-keys JSON hash",
      "how": "The verifier's grep",
      "proof": "verifier"
    },
    {
      "id": "node-only",
      "check": "names.js imports only node: modules, and loading it with xstate absent from node_modules succeeds",
      "how": "The verifier's own test in a copy with xstate removed",
      "proof": "verifier"
    },
    {
      "id": "return-answers",
      "check": "Through the real return-tool server (plugins/harness/scripts/return-tool.mjs over stdio) and the real PreToolUse hook (actors.mjs), a result sent with its keys in a different order from the one accept stored is answered as returned, and a different result is not",
      "how": "The verifier's own test driving both processes from a prepared run",
      "proof": "verifier"
    },
    {
      "id": "installed-layout",
      "check": "With the plugin laid out as setup.sh installs it (lib/engine/src beside scripts/), the return tool and the actor hooks load names.js from lib/engine/src and answer as in return-answers",
      "how": "The verifier's own test building that layout from the head, or scripts/clean-room/run.mjs if it covers it",
      "proof": "verifier"
    },
    {
      "id": "behaviour-unchanged",
      "check": "Every test that passes on main passes at the head, unchanged except for imports",
      "how": "npm test at both shas, and the diff of test files",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The check runs on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [
      "run naming (4 copies) and the result hash (2 copies) into names.js"
    ],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No change to any file name, folder layout or hash value: a journal written on main reads the same at the head",
    "readJson, writeJson, isObject and other one-line helpers stay where they are; they encode no shared decision",
    "No run lifecycle change (run-lifecycle-store)"
  ],
  "records": [
    "none new: journal rows, file names and hashes are unchanged, which behaviour-unchanged checks"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 800000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "An installed plugin from an older release bundles an engine without names.js; the plugin and its bundled engine ship together from one release, so return-tool.mjs only ever loads its own release's engine",
    "The inspector loads an engine checkout older than names.js; it falls back to the repo's own names.js"
  ]
}
```

## What this is

Finding 3 of `plan/research/design-books-cleanup.md`. Only knowledge that two places must agree on moves: how a run id is spelled and parsed, how an
id becomes a safe folder name, where an item's, run's, card's and agent's files are, and how a result is hashed so
the return tool's server and the hook agree. File names and hash values stay exactly as they are.

## Done

Built in PR #163 (merged b251edb), verified by a separate session at 521ff00: all six Expect lines MET. Beyond the
listed copies, `plugins/harness/scripts/capture.mjs` held the safe rule for agent bindings and now uses names.js too.
The return tool and capture load names.js through `host.mjs` `names()`, as `messages()` loads the catalogue, so
`verify/engine-host/plugin-tools.test.mjs` still holds that only the actor hook calls `engine()`. Released with
harness-v0.1.35.

Draft idea from the verifier, not an item yet: `startedRun` in actors.js still spells out `actors/spawns` itself instead
of using names.js's spawn folder.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Without reading the builder's tests, write your
own under `verify/run-names-one-module/`:

- **one-place:** grep the patterns in the Expect line over packages/, plugins/ and scripts/ excluding names.js, test
  folders and vendor/.
- **node-only:** read names.js imports; copy packages/engine/src to a temp folder with no node_modules and import
  names.js from there.
- **return-answers:** prepare a run with the engine (verify/engine-actors or verify/fix-return-tool-answer show how),
  bind an agent, send a result through actors.mjs's PreToolUse for the return tool, then call return-tool.mjs over
  stdio with the same result with its keys reordered (answered) and with one value changed (not answered).
- **installed-layout:** lay the plugin out as infra/cloud-environment/setup.sh does (plugin files plus
  lib/engine/src and lib/engine/messages.md), point CCP_HARNESS_DIR at a temp journal, and repeat return-answers.
- **behaviour-unchanged:** npm test at main and at the head; diff the test folders and show only imports changed.
- **ci:** read the ci and gates checks at the head sha.

This container signs commits: commit evidence holding shas with
`GIT_CONFIG_GLOBAL=/dev/null git -c commit.gpgsign=false commit`. Commit `verify/run-names-one-module/verdict.json`
with a verdict per Expect id.

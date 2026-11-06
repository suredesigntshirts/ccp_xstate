```json
{
  "id": "inspector-catalogue-entries",
  "title": "Show which message catalogue entry each prompt piece came from in the Workflow Inspector",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "For a run recorded since prompt-catalogue, the Workflow Inspector names, beside each prompt piece's source, the message catalogue entry (packages/engine/messages.md) that piece was rendered from, and a fixed or filled frame piece's detail names that entry instead of a stages.js constant. Runs recorded before prompt-catalogue, whose stage.json names no entry, render exactly as before.",
  "why": "prompt-catalogue (harness-v0.1.33) moved every word of the stage prompt frame into named catalogue entries and made stage.json record the entry of each piece (source.entry). The Inspector, the page the person uses to see what each stage was given, still describes a frame piece as 'fixed text in the engine (packages/engine/src/stages.js)', which is no longer where the words live, and does not show the entry at all, so a reader cannot go from a prompt line to the catalogue entry to edit. The change was first made on branch chore/inspector-catalogue-entries (b415600) and PR #152 was closed because a non-plan change needs its own item and verifier.",
  "serves": [
    "L-pages-current-on-demand",
    "L-facts-from-source"
  ],
  "depends_on": [
    "prompt-catalogue",
    "inspector-stage-record"
  ],
  "inputs": [
    {
      "ref": "scripts/inspector/export.mjs sourceRef",
      "what": "Turns a stage.json piece's source into the label and detail the page shows; ignores source.entry today"
    },
    {
      "ref": "scripts/inspector/page.html pieceSource",
      "what": "Renders a piece's source tag and words"
    },
    {
      "ref": "branch chore/inspector-catalogue-entries (b415600)",
      "what": "The change as first written, with a builder's test"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/inspector/export.mjs sourceRef",
      "what": "Carries source.entry on frame, workflow and input pieces, and names the entry in a frame piece's detail"
    },
    {
      "ref": "scripts/inspector/page.html",
      "what": "Shows 'message catalogue entry <name> (packages/engine/messages.md)' beside a piece's source when it has one"
    },
    {
      "ref": "scripts/inspector/test/export.test.mjs",
      "what": "A builder's test of a stage record that names entries"
    }
  ],
  "expect": [
    {
      "id": "entry-shown",
      "check": "Capturing a main engine scenario run made at the PR's head (a stage.json with source.entry on its pieces), every prompt piece the exported bundle and the rendered page show for it names the same entry as its stage.json, and the frame pieces' detail names the catalogue entry, not stages.js",
      "how": "The verifier's own export and render of a captured run, compared with its stage.json files",
      "proof": "verifier"
    },
    {
      "id": "old-runs-unchanged",
      "check": "For a run whose stage.json names no entry (the adopt trial, tournaments/2026-11-04-stage-contract/trials/adopt/journal), the exported bundle equals the one main's export.mjs gives",
      "how": "The verifier's own diff of the two bundles",
      "proof": "verifier"
    },
    {
      "id": "builder-test",
      "check": "The builder's test of a record naming entries goes red when sourceRef's entry handling is reverted",
      "how": "Builder's test, broken by the verifier",
      "proof": "builder"
    },
    {
      "id": "ci",
      "check": "The PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "budget": 0
  },
  "non_goals": [
    "No change to the engine, the catalogue or the workflows",
    "No Inspector view of situational messages (refusals, send-backs) by entry; journal rows carry it, a page for it is its own item",
    "No other page layout change"
  ],
  "records": [
    "The rebuilt Inspector artifact"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 400000
  },
  "verifier": "A separate subagent, using the Verifier brief below."
}
```

## What this is

A follow-up to prompt-catalogue: the Inspector learns the one new field that item added to stage.json.

## Verifier brief

Check out the PR at its head sha and run `npm ci`. Capture a run of main's engine with stage records, such as a
scenario test run with `TMPDIR` kept (docs/inspector.md, "A lane scenario", with the engine `.`), export it with
`scripts/inspector/export.mjs` and build the page; compare each piece's entry and detail in the bundle and the
rendered page with its stage.json. Export the adopt trial journal with the PR's export.mjs and with main's, and diff
the bundles. Revert sourceRef's entry handling and show the builder's test going red. Read the ci check at the head
sha. Commit `verify/inspector-catalogue-entries/verdict.json` with a verdict per Expect id.

```json
{
  "id": "workflow-inspector",
  "title": "Show exactly what every workflow step gives each agent, for any engine and workflow",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The person can open one page and, for any recorded workflow run (main's engine or a tournament lane's, any workflow file), see the graph, each step's event and context change, and for each model step the prompt, the added context, the output schema, the tool trace, the result and the host's accept or refuse, each labelled with where its text came from. Two runs can be compared side by side by actor.",
  "why": "On 2026-11-04 the person asked to know exactly what each agent gets at each step (thread 'Show what's waiting and the architecture', 04:0x-04:55Z). A run inspector added to the hand-made Quick-fix Machine page showed at once that the brief actor's prompt is the bare template writtenBrief() ('Do what the brief step asks') with no authored instructions, so no person wrote any step's instructions. That page is hard-coded to main's engine and quick-fix.json, so it cannot show the tournament lanes, whose prompt designs are what a tournament compares. The person asked for a generic page (05:01Z) built with independent verifiers and a visual reviewer.",
  "serves": [
    "L-agents-self-report",
    "L-facts-from-source",
    "L-attention-is-the-constraint"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "/mnt/project-files/quick-fix-machine/ (gen.mjs, quick-fix-machine.html)",
      "what": "The hard-coded first version with the seven-layer inspector and readable prompt layout"
    },
    {
      "ref": "ccp_xstate_scratch tourney/2026-11-03-context/A-minimalist and C-provenance",
      "what": "Lane engines, workflows and scenario tests (scripted agents, fake GitHub)"
    }
  ],
  "outputs": [
    {
      "ref": "scripts/inspector/",
      "what": "export.mjs (one run to a bundle, engine and workflow given as paths), build.mjs (bundles to index.html + data.js), page.html, test/"
    },
    {
      "ref": "docs/inspector.md",
      "what": "How to export a run, build the page and read it"
    }
  ],
  "expect": [
    {
      "id": "generic",
      "check": "scripts/inspector/ names no state, actor or workflow; the graph is drawn from the workflow JSON for every file in workflows/ and lane A's workflows; model actors are found from run folders",
      "how": "grep plus the exporter run on each workflow file",
      "proof": "verifier"
    },
    {
      "id": "true-to-disk",
      "check": "For fri-jsonl-lint-2 and lane A and C scenario Q1, every prompt, added context, schema, result and trace row the page shows equals the files on disk, and each prompt is labelled with its true source (harness template, an earlier step's output, or a test fixture)",
      "how": "The verifier compares the rendered DOM with the run folders and actors.js",
      "proof": "verifier"
    },
    {
      "id": "usable",
      "check": "In headless Chromium at 1280px and 390px, light and dark, the page has no console errors and no horizontal page scroll, works by keyboard, and compare mode shows the same actor of two runs side by side",
      "how": "Playwright screenshots read by the verifier",
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
      "inspection bundle (one run exported for the page)"
    ],
    "budget": 1
  },
  "non_goals": [
    "No change to packages/ or workflows/; authored step prompts are their own item",
    "No real-agent runs of the lanes; their scenario runs use scripted agents and the page says so",
    "Claude Code's subagent system prompt and the exact tool commands are not recorded today; the page says so rather than guessing"
  ],
  "records": [
    "The published page and its data.js"
  ],
  "step_back": {
    "max_rounds": 5,
    "max_tokens": 3000000
  },
  "verifier": "A separate subagent, using the Verifier brief below.",
  "risks": [
    "Lane engines differ from main's; an export that cannot replay a lane must show what it can and say what it could not replay."
  ]
}
```

Built by a builder with three reviewers each round (a data verifier, a visual and interaction tester, and a critic
answering the person's questions from the page alone), iterating until all three pass.

## Verifier brief

Read this item's head. Rebuild the page from the PR with the documented command. For fri-jsonl-lint-2 and lane A and C
scenario Q1, compare each model step's layers in the rendered page with brief.md, context.md, run.json, result.json and
sessions/*.jsonl on disk, and each prompt's source label with actors.js of that checkout. Grep scripts/inspector/ for
state, actor and workflow names. Render at 1280px and 390px in light and dark, use the page by keyboard, and open
compare mode. Read the ci check at this PR's head sha. Give a verdict per Expect id.

```json
{
  "id": "stage-prompt-files",
  "title": "Keep each stage's instructions in its own markdown file",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Each model stage's instructions (its rules, the meaning of each input, each output field's description, and the brief's fixed task) live in one markdown file per stage beside its workflow, which the workflow JSON names by path. The engine renders the same prompt from them, the workflow pin hashes them with the JSON, and the Inspector traces each prompt line to its file and line.",
  "why": "On 5 Nov the person, having read the prompt-refinement doc, pointed out that keeping prompts as strings inside workflow JSON is not how Claude Code or Codex do it. There, instructions are markdown files: .claude/agents/<name>.md, SKILL.md, CLAUDE.md, AGENTS.md. From first principles the person is right. A prompt is prose that people read, diff and edit; JSON strings hide it behind escaping, and a one-word change shows as a long changed line. Wiring and schemas stay JSON, because the engine checks them. Claude Code's own agent files are not used, because they load only at session start (L-plugins-load-at-start) and each run's inputs must still be filled in at run time (plan/decisions/2026-11-05-stage-prompt-files.md). The layout, the pin and the named-agents question are settled in plan/decisions/2026-11-05-stage-prompt-files-ready.md.",
  "serves": [
    "L-stage-needs-bench",
    "L-theory-written",
    "L-rules-in-spec-not-host"
  ],
  "depends_on": [
    "stage-bench"
  ],
  "inputs": [
    {
      "ref": "packages/engine/src/index.js",
      "what": "loadWorkflow(): reads workflows/<name>.json, hashes its bytes for the pin and stores them as a blob; restores a missing pinned blob from the file"
    },
    {
      "ref": "packages/engine/src/stages.js",
      "what": "sections() and render(): the prompt is assembled from meta.actors.<stage> (rules, inputs, property descriptions) and the invoke's task; sources are JSON pointers"
    },
    {
      "ref": "workflows/quick-fix.json, workflows/research.json, workflows/feature.json",
      "what": "The 8 model stages (quick-fix brief, build, verify; research brief, researcher, write, verify; feature brief) and the brief invokes' task literals"
    },
    {
      "ref": "scripts/bench/lib.mjs",
      "what": "workflowVersion(): a version is the bytes of <name>.json from a file, a git revision or the checkout"
    },
    {
      "ref": "scripts/inspector/export.mjs",
      "what": "sourceRef() labels a workflow source 'workflow JSON'; the workflow is read from the pinned blob or the engine checkout"
    },
    {
      "ref": "plan/decisions/2026-11-05-stage-prompt-files-ready.md",
      "what": "The file format, the composed blob, the load checks, and why named agents are not used"
    }
  ],
  "outputs": [
    {
      "ref": "workflows/<workflow>/<stage>.md",
      "what": "One file per model stage: a title line naming the stage, then ## Rules, ## Inputs, ## Output and, for a stage whose invoke takes a fixed task, ## Task"
    },
    {
      "ref": "workflows/*.json",
      "what": "Each stage's meta.actors entry names its file (prompt) and keeps only its output schema; a fixed task is wired as { \"prompt\": \"task\" }"
    },
    {
      "ref": "packages/engine/src/prompts.js",
      "what": "Reads a workflow with its stage files into the composed spec the engine already runs on, with a line map, and refuses a malformed file naming its path and line"
    },
    {
      "ref": "packages/engine/src/index.js",
      "what": "loadWorkflow() pins and stores the composed workflow's bytes, so a blob alone replays an item; a workflow with no stage files keeps its file bytes as the pin"
    },
    {
      "ref": "stage.json and the Inspector",
      "what": "Every prompt piece from a stage file names its file and line; the Inspector shows them"
    },
    {
      "ref": "scripts/bench/",
      "what": "A workflow version from a git revision or a folder includes its stage files"
    },
    {
      "ref": "docs/prompts.md",
      "what": "Where each prompt part comes from, now the stage file, and how to edit one"
    }
  ],
  "expect": [
    {
      "id": "files",
      "check": "Each of the 8 model stages has workflows/<workflow>/<stage>.md holding its rules, input meanings, output descriptions and (for the three brief stages) its task; no meta.actors entry in workflows/*.json holds rules, inputs or a top-level property description, and no invoke holds a task literal",
      "how": "The verifier reads the files and the JSON",
      "proof": "verifier"
    },
    {
      "id": "same-prompt",
      "check": "For every model stage of the three workflows and a recorded or made-up input, render() on the workflow loaded from its files gives byte for byte the prompt it gave on the base commit's workflow JSON; and for every committed run folder whose journal pins a blob, render() on that blob still gives its committed brief.md",
      "how": "The verifier's own test, rendering both versions",
      "proof": "verifier"
    },
    {
      "id": "pin",
      "check": "Changing one line of a stage file changes the id (name@sha256) a new item pins; an item pinned before the change still loads, replays and renders its prompts from its blob alone, with the stage files deleted; every committed journal still replays",
      "how": "The verifier's own test in a scratch copy of workflows/",
      "proof": "verifier"
    },
    {
      "id": "load-check",
      "check": "A stage file with a missing or unknown section, a name that is not one of the stage's inputs or output properties, an output field out of the schema's order, a ## Task for a stage no invoke wires a task to, or a missing file is refused at load with an error naming the file and line",
      "how": "The verifier's own malformed files",
      "proof": "verifier"
    },
    {
      "id": "traced",
      "check": "A real model run of the quick-fix brief stage, started from the stage files through scripts/bench/run.mjs, writes a stage.json whose every rules, output-description and task piece names workflows/quick-fix/brief.md and the line it came from, and the Inspector built from that run folder shows those file:line labels",
      "how": "The verifier runs one bench case with a real model and builds the Inspector page",
      "proof": "world"
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
      "stage file: one markdown file per model stage holding its prose"
    ],
    "budget": 1
  },
  "non_goals": [
    "No change to any stage's wording: every rendered prompt stays byte for byte the same",
    "No Claude Code agent definitions (.claude/agents, ~/.claude/agents, a plugin's agents/) for stages: decided in plan/decisions/2026-11-05-stage-prompt-files-ready.md",
    "No frontmatter: the JSON keeps the wiring, so a stage file has nothing to declare",
    "No change to the journal format or to blobs already committed"
  ],
  "records": [
    "each run's stage.json, with file and line on every piece from a stage file",
    "the composed workflow blob each new item pins"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 1500000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

## What this is

It comes before wf-intake and refine-brief-stage, so that new stages and rewritten rules are written in the files from
the start. The file layout, the format and the pin are decided in `plan/decisions/2026-11-05-stage-prompt-files-ready.md`:
the engine composes the JSON and the stage files into the same spec it runs on today, pins and stores that composed
spec, and keeps a map from each filled-in JSON pointer to its file and line. So `render()`, the chart and the replay
are unchanged, and a blob alone replays an item. A done item's verifier test that reads raw `workflows/*.json` for
rules may be changed only to read the composed workflow, checking the same outcome.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Write your own tests under
`verify/stage-prompt-files/` without reading the builder's. For files, read every `workflows/<workflow>/<stage>.md`
and the JSON. For same-prompt, take the base commit's `workflows/` from git, render every model stage of the three
workflows on both versions with the same inputs (the committed run folders' inputs, and made-up inputs for stages that
have none), compare the bytes, and render the committed run folders' prompts from their pinned blobs. For pin, edit one
stage-file line in a scratch copy, load and compare ids, then load a pinned item with the stage files deleted and replay
it, and run `test/journals-replay.test.mjs`. For load-check, write the malformed files yourself. For traced, run one
brief case of `bench/brief/` with a real model from the files, read its `stage.json`, and build the Inspector from the
run folder. Read the ci check at the head sha. Commit `verify/stage-prompt-files/verdict.json` with a verdict per
Expect id.

```json
{
  "id": "second-workflow",
  "title": "Run a second kind of work through a different workflow",
  "stage": "s5-parity",
  "kind": "build",
  "status": "ready",
  "outcome": "The three view fixes run as one real item through the feature workflow, picked by the person and recorded as their pick when the item is filed: overhead attributes a session's tokens to the PRs whose Claude-Session trailer names it, whatever form the trailer's session takes; time counts only the person's own messages and taps as waiting on the person and GitHub check results as waiting on CI; rework counts an item's readying replan against that item's build PR. The host runs an item whose state invokes a workflow, child items included, from the command line, so a feature item is driven the way quick-fix items are.",
  "why": "Different workflows for different work is the person's goal for v2, and only quick-fix has run real work. On 11 Nov the person picked feature and proposed derive-view-gaps as the item (plan/decisions/2026-11-11-v1-out-of-scope.md): its three view fixes are natural slices, and they are the views that make the run's cost visible (L-harness-overhead, L-rework-invisible). One workflow running doesn't prove the swap works. Reading the host for this replan found that bin/host.js never runs a child item: the effect library has the item handler and pump(), but the command wires neither, so a feature item started from a session stops at its first slice. The selection is the other gap: the start row's source is the session that filed the item, which is not who picked the workflow (L-builder-supplies-gate-inputs).",
  "serves": [
    "L-rules-in-spec-not-host",
    "L-builder-supplies-gate-inputs",
    "L-measure-then-park",
    "L-harness-overhead",
    "L-rework-invisible"
  ],
  "depends_on": [
    "retro-first-item",
    "wf-intake",
    "refine-brief-stage"
  ],
  "inputs": [
    {
      "ref": "plan/decisions/2026-11-11-v1-out-of-scope.md",
      "what": "Why feature, why these fixes, and the one risk taken: the run is in this repo"
    },
    {
      "ref": "workflows/feature.json",
      "what": "planning, slicing (three quick-fix children on the feature's grant), finishing (a quick-fix child into the default branch) and replanning"
    },
    {
      "ref": "packages/engine/src/effects/item.js",
      "what": "The child item handler, childResults, settle, openItems and pump, which bin/host.js does not use today"
    },
    {
      "ref": "packages/engine/bin/host.js",
      "what": "start, wake, show, card, closed and answer, each on one item"
    },
    {
      "ref": "packages/journal/src/derive/",
      "what": "overhead.js, time.js and rework.js, the three views the fixes change"
    },
    {
      "ref": "packages/journal/bin/derive.js",
      "what": "prFacts: the trailer sessions, the PR's item and labels, its files"
    },
    {
      "ref": "plugins/harness/scripts/capture-rows.mjs",
      "what": "The wake, person.message and person.tap rows time reads"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/bin/host.js",
      "what": "Every command drives the item and its open child items; waiting and show name each run's item; start records the selection"
    },
    {
      "ref": "packages/engine/src/host.js",
      "what": "The selection on the start's engine.transition row: the pinned workflow id, who picked it and how"
    },
    {
      "ref": "packages/journal/src/derive/, packages/journal/bin/derive.js, plugins/harness/scripts/capture-rows.mjs",
      "what": "The three view fixes, built by the feature run's slices"
    },
    {
      "ref": "docs/journal.md, packages/engine/README.md",
      "what": "What the views count now, the selection field, and the host's child items"
    },
    {
      "ref": "The item second-workflow in the project journal",
      "what": "The feature run itself: its rows, its children's rows and their runs"
    }
  ],
  "expect": [
    {
      "id": "selected",
      "check": "The item's first engine.transition row names its pinned workflow, feature@<sha256>, and its selection: the person as who picked it and how they picked it, as the filing gave them; another start for the item, whatever workflow it names, is refused, and the item keeps the workflow and hash it was filed with",
      "how": "The verifier reads the real item's first row, and tests a second start through bin/host.js on an item it starts",
      "proof": "verifier"
    },
    {
      "id": "children",
      "check": "bin/host.js drives an item whose state invokes a workflow: start, wake and answer offer each event to the item and to every open child item, a child that ends hands its output to its parent in the same call, show and the waiting list name every run in the tree with its item, and card, closed and answer act on a child item's ask run named by its effect id",
      "how": "The verifier's own test: a feature item driven through bin/host.js with stub agent results",
      "proof": "verifier"
    },
    {
      "id": "overhead",
      "check": "overhead attributes a session's tokens to the PRs whose commits' Claude-Session trailers name it, whether a trailer gives the session's URL, its session_ id, its URL with #agent=<name>, or a local session id, and whether the journal keys the session by URL or by id",
      "how": "The verifier's own test over rows and PR facts it writes",
      "proof": "verifier"
    },
    {
      "id": "time",
      "check": "time counts a gap as waiting on the person only when the wake that ends it carries the person's own message or tap, and as waiting on CI when that wake brings a GitHub check result; a prompt with no wake envelope, such as a coordinator's relay or a driver's prompt, is a wake",
      "how": "The verifier's own test over wake rows it writes, in the shapes capture writes them",
      "proof": "verifier"
    },
    {
      "id": "rework",
      "check": "rework counts a PR labelled replan that names no item against the item whose file under plan/items/ it changes, so that item's build PR shows the replan in replans",
      "how": "The verifier's own test over PR facts it writes",
      "proof": "verifier"
    },
    {
      "id": "ran",
      "check": "The real item second-workflow, filed on feature in the project journal, went from planning to slicing, and each of its three slices ran as a quick-fix child item through briefing, building, checking and verifying to done, its PR merged into the build PR's branch on the feature's grant; every applied transition's source is a result the return hook checked, a wake, a timer, a child's end or the host's own effect, and the slices' merged PRs carry the three fixes above",
      "how": "The project journal's item files and GitHub's slice PRs",
      "proof": "world"
    },
    {
      "id": "ci",
      "check": "The build PR's ci check is green at the head sha",
      "how": "The ci check run on GitHub",
      "proof": "world"
    }
  ],
  "cases": [
    "C-builder-cannot-change-own-workflow"
  ],
  "concepts": {
    "adds": [
      "workflow selection: who picked an item's workflow and how, recorded when it is filed"
    ],
    "budget": 1
  },
  "non_goals": [
    "No workflow editor",
    "No change to workflows/feature.json, workflows/quick-fix.json or their stage files: the run tests them as they are",
    "No selection made by the harness: the person picks, and the filing records it",
    "No backfill of rows written before the fixes; the views read old rows as they read them now where a new field is missing",
    "No comparison page beyond what the observe page's item scope already shows"
  ],
  "records": [
    "engine.transition with workflow id and hash, and on the start row the selection",
    "the feature item's file and its children's files in the project journal, with every run's brief, stage and result",
    "capture's wake rows with the GitHub event kinds a wake carries, if the time fix needs them"
  ],
  "person_prereqs": [],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 4000000
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below."
}
```

The item and workflow were picked on 11 Nov (`plan/decisions/2026-11-11-v1-out-of-scope.md`): feature, on the work
`derive-view-gaps` held, which is merged here. The item runs in this repo, so the feature workflow's PRs meet this
repo's gates; that is part of what the run tests.

## The three bugs, checked again on main

- **overhead.** `overhead()` keys sessions by `r.session`, which capture writes as the session's URL
  (`https://claude.ai/code/session_X`), and `prFacts` keeps only the `session_X` part of a trailer. The two never
  meet, so every session is unattributed. A trailer can also be `<url>#agent=<name>` or a local session id, which
  the trailer pattern drops. Both sides are read to one key.
- **time.** `WAIT_KINDS` maps the wake reason `prompt` to the person. Capture gives `prompt` to any prompt with no
  wake envelope: a coordinator's relay, a headless driver's prompt. In the project journal on 11 Nov, `prompt` is the
  second most common reason, and no wake row is `external-event`, so ci waiting is 0. The person's own message or tap
  is already its own row (`person.message`, `person.tap`), so time reads those, not the reason.
- **rework.** `itemOf` gives a PR its `Item:` line, else its branch's last segment. A readying replan has no
  `Item:` line and a topic branch, so it links only when the topic happens to equal the id. Its changed file under
  `plan/items/` names the item it readies.

## How the run goes, and why in this order

The build PR is `build/second-workflow` into main, and that branch is the feature's branch. The builder's own work
comes first, in the PR's first commits: the status, the selection, and `bin/host.js` driving child items, because a
feature item cannot run past its first slice without it. Then the item is filed on feature with the person as the
picker, and the builder's session drives it: each waiting run gets its agent, each GitHub check event reaches the
host as the wake the platform delivered. Each slice is a quick-fix child whose PR targets the build branch and merges
on the feature's grant, so the three fixes land on the build PR's branch through the feature workflow.

The verdict comes once the three slices are merged, before the feature's final child starts. The final child is a
quick-fix into main from the build branch, and this repo's `verdict` check is red on a PR until its verdict file is
committed: started before the verdict, the final child would see a red check and send its builder back forever. Once
the verdict is on the branch, the final child's builder returns the build PR at its head, its verify stage checks the
goal there, and the merge ask is answered under a grant, as every development merge is
(`plan/decisions/2026-11-04-tap-only-for-production.md`). So `ran` is checked up to the slices; the final merge and
the feature item's end follow the verdict, as any build PR's merge does, and the release reports them.

The risk: the final child's builder is told to open a PR from the build branch, and one already exists. If it cannot
return that PR, the item blocks, and the fixes are already on the build branch, which the builder merges as any build
PR; the retro says which.

## Verifier brief

- Read the item head, `workflows/feature.json`, `packages/engine/bin/host.js` and `packages/journal/src/derive/`. Do
  not read the builder's tests or the slice PRs' tests before writing your own.
- `children`: drive a feature item through `bin/host.js` with `--root` in a temp folder. Stub agents by writing
  each run's result where the return tool would and offering it, as `packages/engine/test/` does; no model is needed.
- `selected` and `ran`: the project journal is `/mnt/project-files/harness/journal`; the item file is
  `items/second-workflow.jsonl` and each child's is named by its run's effect id. Read it; never write to it. Try
  the second start on an item of your own in a temp root.
- `overhead`, `time`, `rework`: write rows and PR facts in the shapes capture and `prFacts` make, including the old
  shapes, and check each view's output, not its code.
- Evidence is one small file per Expect line; no test listing, journal copy or capture of main.

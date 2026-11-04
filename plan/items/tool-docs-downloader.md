```json
{
  "id": "tool-docs-downloader",
  "title": "Install the documentation-downloader skill in every container",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "outcome": "Every new ccp_xstate container has the documentation-downloader skill (v2, skill-documentation-downloader PR #2 branch at e011667) at ~/.claude/skills/documentation-downloader with its npm dependencies installed, so sessions list the skill and can cache external docs verbatim and search them by section.",
  "why": "The person asked for it on 2026-11-04 15:15Z in the thread 'Research GAN and harness ideas for workflows' (\"Install documentation downloader in this harness … This branch.\"), after a research task could not use it because it was not installed and had to save sources with curl. Repo .claude/skills do not load in threads (L-repo-skills-dont-load), and the container is rebuilt from the setup script (L-container-is-ephemeral), so the copy has to live in the repo and be installed by setup, like the ccp-harness plugin.",
  "serves": ["L-container-is-ephemeral", "L-repo-skills-dont-load", "L-setup-script-stub"],
  "depends_on": [],
  "inputs": [
    { "ref": "suredesigntshirts/skill-documentation-downloader PR #2, head e011667601fb9396c7c65c81b47ffa53870c6ce5", "what": "The skill, v2.0.0" }
  ],
  "outputs": [
    { "ref": "vendor/documentation-downloader/", "what": "The skill copied verbatim at e011667, without eval/ and .github/" },
    { "ref": "vendor/README.md", "what": "Source, sha, what was left out, how to refresh, the hard-link limit on /mnt/project-files" },
    { "ref": "infra/cloud-environment/setup.sh", "what": "Step 2b: copy vendor/documentation-downloader from git HEAD to ~/.claude/skills/ and npm ci there" },
    { "ref": "test/setup.test.mjs", "what": "copy-not-link expects both installed folders" },
    { "ref": "CLAUDE.md, docs/layout.md", "what": "vendor/ added to the layout; vendor/ is outside the dependency rule" }
  ],
  "expect": [
    {
      "id": "verbatim",
      "check": "vendor/documentation-downloader/ is byte-identical to git archive of skill-documentation-downloader e011667 minus eval/ and .github/",
      "how": "The verifier archives that sha itself and diffs recursively",
      "proof": "verifier"
    },
    {
      "id": "setup-installs",
      "check": "Running setup.sh with a fresh HOME (CCP_SETUP_FETCH unset) leaves ~/.claude/skills/documentation-downloader with SKILL.md and node_modules, and `npm run doctor` there reports Ready; with CCP_SETUP_FETCH=0 it copies without npm; a second run gives the same files",
      "how": "The verifier runs setup.sh twice in temp HOMEs from a clone at the PR head",
      "proof": "verifier"
    },
    {
      "id": "fetches",
      "check": "From the installed copy, `docs fetch` of a real docs page writes external-docs/<host>/<path>.md and `docs search` returns a line range in it",
      "how": "The verifier fetches a page of its choosing in a temp folder in this container",
      "proof": "world"
    },
    {
      "id": "tests",
      "check": "npm test and node plan/check.mjs pass at the PR head",
      "how": "Run both",
      "proof": "builder"
    }
  ],
  "cases": [],
  "concepts": { "adds": ["vendor/ folder for third-party tools"], "budget": 1 },
  "non_goals": [
    "No change to the skill's code; fixes go upstream to skill-documentation-downloader",
    "No committed external-docs/ cache in this repo",
    "No Chromium download: the container's preinstalled browser is used"
  ],
  "records": ["setup log lines 'installed …/documentation-downloader' or the reason it was not"],
  "person_prereqs": [],
  "step_back": { "max_rounds": 2, "max_tokens": 1000000 },
  "verifier": "A separate subagent, using the Verifier brief below."
}
```

The person asked to install the skill "in this harness" from the PR #2 branch. Three ways were open:

- **A project skill at `.claude/skills/`**, as the skill's README suggests. Rejected: in this project, repo skills do
  not load in threads (ledger L-repo-skills-dont-load).
- **Setup clones the skill repo.** Rejected: setup would need network access and credentials for a second private
  repo at container build, and the version would drift with that repo.
- **Vendor a pinned copy and have setup install it** (chosen). This is the same pattern as the ccp-harness plugin:
  the copy comes from git, never the working tree, and the version only changes through a PR here.

The skill has its own npm dependencies (playwright, domino, and others). They install inside
`~/.claude/skills/documentation-downloader`, not in this repo's workspaces, so the "no runtime dependency except
xstate" rule for harness code is unchanged; `docs/layout.md` says so.

The skill's atomic writes use hard links, which `/mnt/project-files` refuses (ENOTSUP, seen 2026-11-04). It works in
a local folder, and the results can be copied to the shared folder afterwards. This is reported in `vendor/README.md`, not
patched here.

## Verifier brief

You verify plan item tool-docs-downloader at the PR head sha. Clone suredesigntshirts/skill-documentation-downloader
yourself (it is attached to the session), archive e011667 without eval/ and .github/, and diff it against
vendor/documentation-downloader/. Run infra/cloud-environment/setup.sh from a fresh clone of the PR head with temp
HOMEs, once without CCP_SETUP_FETCH and once with CCP_SETUP_FETCH=0, twice each; check the installed folder and run
`npm run doctor` there. From that installed copy, fetch one real docs page you choose into a temp folder and search
it. Run npm test and node plan/check.mjs. Commit verify/tool-docs-downloader/verdict.json per docs/gates.md.

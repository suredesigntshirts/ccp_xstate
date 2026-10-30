# Platform baseline

**Date:** 2026-10-30, 10:10Z to 10:30Z
**Claude Code:** 2.1.314 (built 2026-10-29T20:53:59Z), from the mod's `$.session.version()` and `claude --version`
**Model served:** the thread ran on `claude-opus-5-5` (session `configured_model` and `last_served_model`). Headless
`claude -p` children ran on `claude-sonnet-5-5`; subagents the mod spawned ran on `claude-opus-5-5` in the live thread
and `claude-sonnet-5-5` headless.
**Where:** a Projects cloud thread in the v2 project (`ccp_xstate`), permission mode auto, plus headless
`claude -p --permission-mode auto` children in the same container.
**Probe code and evidence:** `probes/platform/` (commands in its README), raw logs in `probes/platform/fixtures/`.

## Read this first: which rules were in force

The container started "resume-cached" and `/tmp/env-manager.log` says "Skipping initialization script for faster
startup". `infra/cloud-environment/setup.sh` never ran, so `~/.claude/settings.json` did not exist: **none of the
repo's `autoMode.allow` rules were in force** and `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH` was 1. Every "allowed" below
was allowed by auto mode's defaults alone, which is a stronger result than the item asked for. Every refusal below
happened without the rules too, so a refusal may not survive the rules. The rebuild is on
`plan/decisions/waiting-for-person.md`.

## Results

| Assumption (ledger) | Answer | Evidence |
|---|---|---|
| A mod's `$.agent.spawn` runs on a send_later wake with no person message (L-classifier-judges-the-request) | **Holds now: allowed.** v1's 28 Oct refusal did not reproduce. | `fixtures/wakes/2026-10-30-send-later-wake.json` (`mod_spawn`, agent `af965df07865dce6e` answered) |
| A mod's `$.agent.spawn` runs on a GitHub PR event wake with no person message (L-classifier-judges-the-request) | **Holds: allowed** twice: on `check_suite.completed` (model spawn) and on `pull_request.closed` (mod spawn). | `fixtures/wakes/2026-10-30-pr-event-wake.json` |
| The thread's model may spawn with the Agent tool on either idle wake (fallback host design) | **Holds: allowed** on both wake kinds. | same two fixtures, `model_spawn` |
| A merge through the GitHub merge tool on an idle wake (L-merge-without-review-flag) | **Allowed** on a send_later wake, ccp_xstate_scratch#1, with no rule in force. No [Merge Without Review] flag, and later calls were not denied. | `fixtures/wakes/2026-10-30-send-later-wake.json` (`model_merge`, merge sha e5129939) |
| A mod spawns from a timer with no turn at all | **Allowed** headless (`$.clock.after`, run 2). | `fixtures/runs/2026-10-30-runs-1-2.jsonl`, label `timer` |
| What a mod sees of a wake | **Only a summary.** Both wake kinds reach `turn.start` as the same `<task-notification>` "queued-remote-notifications" text. The body (send_later message, GitHub event JSON) comes only from the model's `ReadNotifications` call. A mod can tell *that* a wake came, not *what* it says. | both wake fixtures, `turn_text_as_mod_saw_it` |
| `$.mcp.call` reaches the project's thread tools from a mod (L-mods-capabilities) | **Holds** in a live thread: `hearthbot.read_thread`, `hearthbot.request_decision` (card posted, then closed by the thread) and `claude-code-remote.send_later` (trigger created) all returned `isError: false`. Headless it doesn't: those servers aren't connected in `claude -p` ("no connected MCP tool"). | `fixtures/wakes/2026-10-30-pr-event-wake.json` (`second_wake.mod_mcp_calls`); `fixtures/runs/live-thread.jsonl`; run 1 lines `probe:"mcp"` |
| `$.agent.spawn` honours `cwd` (L-spawn-ignores-cwd) | **Doesn't hold.** Asked for `/tmp/probe-cwd-target`, the subagent's `pwd` was the parent's `/tmp`, twice (runs 1 and 2). What works instead: subagents start in the session's working folder (the live thread's `pwd` followed the session's current directory), so name the folder in the brief and have the agent `cd` there. | runs 1-2 lines `"label":"cwd"`; smallest repro in the README |
| How a classifier refusal shows to the model, hooks and a mod | **To the model:** a tool_result error, "Permission for this action was denied by the Claude Code auto mode classifier. Reason: [Category]. ..." **To settings hooks:** a `PermissionDenied` hook fires with `tool_name`, `tool_input`, `tool_use_id` and `reason: "[Self-Modification]"` (the category only); no PostToolUse fires. **To a mod:** `tool.call`'s `await next(e)` resolves `isError: true` with the full refusal text in `text`, and `deny` is unset. So a mod can't tell a classifier refusal from a tool error except by the text. The debug log also has `Auto mode classifier blocked action: [Category]`. Captured live at 11:34Z, when this thread tried the SessionStart probe below (a real refusal, not a staged one). | `fixtures/refusals/2026-10-30-self-modification-live-mod-and-hook.jsonl`, `fixtures/refusals/` (the two earlier refusals and the debug log excerpt) |
| Retrying after a refusal reads as a bypass (L-retries-look-like-bypass) | Not re-tested. The second refusal ([Self-Modification]) was a different action with the intent stated; it was refused too. Stopped there. | `fixtures/refusals/2026-10-30-self-modification-outer.json` |
| Subagent depth (L-subagent-depth) | **Unclear at 1, holds at 3.** With `CLAUDE_CODE_MAX_SUBAGENT_SPAWN_DEPTH=1` (this container's value) the builder saw a subagent with no Agent tool in 2 of 2 runs (run 3, and a 10:27Z rerun where `=0` gave the Agent tool and `nested-ok`), but the verifier's 3 reruns at `=1` got a second level that answered `nested-ok`. With `=3`, three levels ran (`nested-3-ok`). Don't rely on the default: set the value explicitly and have the self-check spawn one nested agent. | `fixtures/runs/2026-10-30-results.jsonl` runs 3 and 5, `fixtures/runs/2026-10-30-depth-rerun.txt`, verifier notes in `verify/probe-platform-baseline/verdict.json` |
| SessionStart settings hook budget (L-hook-time-budget) | **No timeout set: at least 70 s;** the session waited the full 70 s before starting. **`timeout: 5`: killed at 5 s** (4 ticks, no end line). | runs 3-5 log (70 s), `fixtures/runs/2026-10-30-run-6-configured-timeouts.jsonl` |
| PreToolUse settings hook budget | **No timeout set: at least 20 s,** the tool waited. **`timeout: 5`: killed at 5 s.** | runs 1-2 log (20 s), run 6 log |
| A mod hook's budget | **Declared 10,000 ms** (`next.budget` read `{ms: 10000}`), but a 15 s busy loop in `turn.start` was **not** aborted (`next.signal.aborted` stayed false) and its later `$` calls (two spawns, a timer) still ran. The turn did not wait for it: the model's first tool call came 2 s in. Treat 10 s as a soft budget on `turn.start`; don't put work there that the turn needs. | runs 1-2 log `probe:"mod-budget"` |
| A thread may commit under `plugins/` while a released copy of that plugin is loaded (L-no-self-modification) | **Allowed.** Commit 6d56840 in ccp_xstate_scratch, branch `probe/self-edit-released`, changes `plugins/effect-harness/hooks/register.ts` while the session ran the released `effect-harness`. Pushed, no refusal. | `git -C ccp_xstate_scratch show 6d56840` |
| ...and when the session loads the working tree | **Allowed** headless: a `claude -p` session with `--plugin-dir plugins/platform-probe` edited and committed that plugin's `register.ts`. The live thread also edited its own loaded dev mod (hot-reloaded) with no refusal. Settings are different: asking a child to add an allow rule to its own project settings was refused [Self-Modification] in the outer thread. | `fixtures/runs/2026-10-30-run-3-self-edit-git-log.txt`; `fixtures/refusals/2026-10-30-self-modification-outer.json` |
| Plugins load at start; edits change nothing mid-session (L-plugins-load-at-start) | **Partly changed.** Mods written to the session's mods folder hot-reload at the end of the turn that edits them, once the person turns mods on. Each reload ran `session.start` again (log shows four). Plugins from `--plugin-dir` and marketplaces still load at start. | `fixtures/runs/live-thread.jsonl` `session.start` lines |
| Headless spawns need a live main turn (L-headless-spawn-needs-live-turn) | **Holds in practice**: in run 2 the main turn stayed alive because the model waited for its subagents; the timer spawn fired 5 s after its turn hook. | runs 1-2 log |
| Rules work only if placed before the session (L-rules-before-session) | **Untested,** because no rules were placed. Not run by the thread itself (that would be a self-placed rule). | this section |
| GraphQL blocked, REST only (L-graphql-blocked) | **Untested** this run. The GitHub MCP tools (REST) worked for PR create, merge and subscribe. | — |
| A page reads a Library JSONL through `files` | **Holds.** The project owner opened the page. `files.list` found `probes/platform/probe-journal.jsonl` and `files.read` returned 1488 bytes (revision 6eb7ee3d…), and all 4 JSONL rows parsed, on 4 loads between 11:30Z and 11:32Z. The read asks the viewer once; a viewer outside the project gets `not_found`. | `fixtures/runs/2026-10-30-page-read-results.json` (from the page's db), https://claude.ai/artifact/YUMK21WxirbJgGCE7ppaQj |
| A `claude -p` child loads the parent session's mods folder | **Observed:** run 6, started after the person turned mods on, logged the dev mod's `session.start` (it shares the parent's session id). Check this before using headless runs as clean rooms. | `fixtures/runs/live-thread.jsonl` first two lines |

## Setup script vs SessionStart

The person asked whether a SessionStart hook or mod should keep the settings current instead of, or as well as, the
setup script. What was seen:

- **Setup script:** runs when a container is built for a new session. A thread resumed on a cached container skips
  it: env-manager logged "Skipping initialization script for faster startup" at 10:07Z, and again at 11:33Z after the
  person re-saved the script. A re-save reaches new threads, not running ones.
- **Repo `.claude/settings.json`:** never loads here. Threads start in `/home/user`, not the repo
  (L-repo-skills-dont-load), so only `~/.claude/settings.json` counts.
- **A SessionStart hook started from inside the thread:** refused. This thread tried a `claude -p` child whose
  plugin SessionStart hook runs `setup.sh`, with the person's ask stated in the prompt. Auto mode denied it as
  [Self-Modification] before the child started (11:34Z). A thread placing its own rules is the case
  L-rules-before-session warns about. It was not retried.
- **Not tested:** a SessionStart hook in a plugin the person installs, which runs before the thread's first turn
  with no classifier in the way. Settings it writes probably land after the session read its settings, so they
  would count from the next start or resume, not the current session.

Recommendation, for setup-script and env-bootstrap: keep the setup script as the way rules arrive. Add a SessionStart
hook in the v2 plugin that only *checks*: is `~/.claude/settings.json` there, are the rules in it, is the depth 3.
When something is missing, it says so loudly at session start and records it. Whether that hook should also write
the settings (for the next resume) is a one-way door about settings, so it is for the person, on
waiting-for-person.md.

## What this changes for later items

- **engine-host:** the host can be a mod reacting to wakes. Spawns from `turn.start` on both wake kinds were
  allowed with no rules in force. But the mod can't read the wake's body, so the host must either keep its own
  record of what it scheduled and why, or let the model read notifications and hand the body to the mod (a mod tool).
- **env-bootstrap / setup-script:** a cached container can skip the setup script. The self-check must test for
  `~/.claude/settings.json` and the depth value, not assume them.
- **engine-actors:** give each actor its folder in the brief (cwd is ignored). Don't rely on a hook budget for
  `turn.start` work; use `$.clock` or `session.start`.
- **obs-refusal-log:** a classifier refusal fires no PostToolUse. Capture it from the debug log line or the tool
  result text; whether a mod's `tool.call` sees `deny` for a classifier refusal is still open.
- **L-classifier-judges-the-request, L-merge-without-review-flag:** both were allowed today with no rules. Rerun after
  the rebuild to confirm the rules don't change that, and keep the rules anyway in case the classifier changes.

## Allow rules

The full v2 set, in plain words, for person-setup-sitting. The first seven are already in `.claude/settings.json`
on main; the probe found nothing that needs more. One-line summary of each:

1. The probe mod may start subagents on any wake, including timer and GitHub event wakes (probe only).
2. `claude -p --plugin-dir probes/platform` headless probe runs are allowed.
3. The probe may merge PRs in the scratch repo on any wake.
4. The person delegated the plan to Claude threads: branch, commit, push, open PRs and issues, and merge their own
   PRs in both repos when CI is green at the head sha and an independent verifier passed that sha.
5. Threads may start builder and verifier subagents (Agent tool or a mod's `$.agent.spawn`) on any wake.
6. Editing and committing under `plugins/`, `packages/`, `probes/`, `infra/` and `verify/` is building the product,
   not self-modification. `.claude/settings.json` is excluded and waits for the person.
7. In ccp_xstate_scratch, threads may open, push to, make red, merge, revert and close scratch PRs on any wake.

None of these were in force during the probe. They take effect only after the person rebuilds the environment.

## Verdict and what is left

The independent verifier (verify/probe-platform-baseline/verdict.json, at 4239dac) marked 6 Expect lines MET
(versions, mcp-from-mod, self-edit, cwd, rerunnable, negative-evidence) and 5 NOT MET. Since then two of the 5 have
new evidence (below), which needs a new verdict. The item is not done, so this
PR is not merged (plan/README.md, "How slop is kept out"). Each open line and what closes it:

- **idle-spawn, idle-merge:** answered with no allow rule in force, not under the pre-placed rule the line names.
  The person re-saved the setup script at about 11:30Z, so a new thread should start with the rules. Rerun the two
  wake probes (README) there, after checking `~/.claude/settings.json` exists.
- **page-reads-journal:** now holds (11:30Z, opened by the person).
- **hooks-see-refusals:** now answered for the mod and settings hooks (11:34Z refusal, above).
- **depth-and-budgets:** depth 1 gave conflicting results (above). Rerun in that new thread, where depth should be 3.

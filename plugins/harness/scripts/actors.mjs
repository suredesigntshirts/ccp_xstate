#!/usr/bin/env node
// The actor hooks: how the harness starts an invoked actor's agent, keeps it in its
// worktree and checks what it returns. The logic is packages/engine/src/actors.js; this file reads the hook input,
// calls it and answers Claude Code. In a project that hasn't installed the harness it does nothing.
//
//   PreToolUse of Agent with the prompt `ccp-run <run>`: swap in the run's brief, or refuse an unknown or started run.
//   PreToolUse of the return tool: refuse unless the caller, the schema and GitHub check out, saying how to fix it and
//     which refusal of the run's cap this is; then hand the result to the item, which prepares the runs its next state
//     invokes. The refusal that reaches the cap fails the run, and its error goes to the item.
//   PreToolUse of any other tool a bound agent calls: run shell commands from its worktree, refuse file tools outside.
//   SubagentStart: bind the agent to its run and give it its run, worktree and return instructions. When the session
//     has several runs starting at once, the agent is bound at its first tool call instead, from its meta.json.
//   SubagentHandback, or SubagentStop, of a bound agent whose run has no result: send it back once to call the return
//     tool; the next time it ends, fail the run, so the item gets the actor's error instead of waiting.
//     A stop after a handback fails at once: a block doesn't bring that agent back.
//   PreToolUse of Agent with the prompt `ccp-cannot-start <run>: <why>`: refuse the call and fail the run with the
//     session's reason, so its item takes the error path.
//   Stop of the main session with a run of an item it owns prepared and no agent: block with the exact Agent call,
//     at most twice per run by the stall rows in the journal; the stop after that fails the run.
//   PostToolUse of Agent in the main session, and UserPromptSubmit (a wake, such as a background agent finishing):
//     say which runs of this session's own items are prepared and waiting for their agent.
//
// A refusal is a PreToolUse deny whose reason starts with its rule (`wrong-caller: ...`), journalled in the item's
// file. A call it adds nothing to gets no output, so the normal permission flow still decides it.
import { readFileSync } from 'node:fs';
import { engine, gate, journalDir, sessionName, stdin } from './host.mjs';
import { handedBack, read } from './capture-rows.mjs';

const out = (hookSpecificOutput) => process.stdout.write(`${JSON.stringify({ hookSpecificOutput })}\n`);
const deny = (reason) => out({ hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason });
const rewrite = (updatedInput) => out({ hookEventName: 'PreToolUse', updatedInput });

// The Agent call that started a subagent, from its meta.json beside the session transcript. It exists from the
// agent's first tool call on, not yet at SubagentStart.
function spawningToolUse(input) {
  if (!input.transcript_path || !input.agent_id) return null;
  try {
    return JSON.parse(readFileSync(`${input.transcript_path.replace(/\.jsonl$/, '')}/subagents/agent-${input.agent_id}.meta.json`, 'utf8')).toolUseId ?? null;
  } catch {
    return null;
  }
}

// Hands a failed run's error to its item, which steps back.
async function deliverFailed(A, root, run) {
  const { github } = await engine('effects/github.js');
  await A.deliver({ root, run, github: github({ ...(process.env.CCP_GITHUB_API ? { api: process.env.CCP_GITHUB_API } : {}) }) });
}

async function main() {
  const text = await stdin(2000);
  if ((await gate()) !== 'installed') return;
  const input = JSON.parse(text);
  const root = journalDir();
  const A = await engine('actors.js');
  const session = sessionName(input);
  const event = input.hook_event_name;
  const tool = input.tool_name;

  // The names this session may own items under: its id, and the cloud URL form (start --session may take either).
  const owners = [input.session_id, session];
  if (event === 'PreToolUse' && tool === 'Agent') {
    const no = A.cannotStart({ root, prompt: input.tool_input?.prompt, sessions: owners, session });
    if (no) {
      deny(no.deny);
      if (no.failed) await deliverFailed(A, root, no.failed);
      return;
    }
    const r = A.spawn({ root, prompt: input.tool_input?.prompt, toolUseId: input.tool_use_id, session: input.session_id ?? null });
    if (!r) return;
    if (r.deny) return deny(r.deny);
    return rewrite({ ...input.tool_input, prompt: r.prompt });
  }
  if (event === 'PreToolUse' && A.isReturnTool(tool)) {
    const { github } = await engine('effects/github.js');
    const gh = github({ ...(process.env.CCP_GITHUB_API ? { api: process.env.CCP_GITHUB_API } : {}) });
    const got = await A.accept({ root, caller: input.agent_id ?? null, run: input.tool_input?.run, result: input.tool_input?.result, toolUseId: input.tool_use_id, github: gh, session });
    if (got.refused) {
      deny(A.refusalText(got));
      if (got.failed) await A.deliver({ root, run: got.failed, github: gh });
      return;
    }
    await A.deliver({ root, run: got.accepted.run, github: gh });
    return;
  }
  if (event === 'PreToolUse' && input.agent_id) {
    const late = A.bindLate({ root, agentId: input.agent_id, metaToolUseId: spawningToolUse(input), agentType: input.agent_type ?? null, session });
    if (late?.deny) return deny(late.deny);
    // Bound only now (SubagentStart couldn't tell which run): this call doesn't run, so the agent reads its run first.
    if (late?.bound) return deny(A.boundText(late.bound.context));
    const bound = A.boundRun(root, input.agent_id);
    if (!bound) return;
    if (tool === 'SubagentHandback') {
      const h = A.handback({ root, agentId: input.agent_id, session });
      if (h?.deny) return deny(h.deny);
      if (h?.failed) await deliverFailed(A, root, h.failed);
      return;
    }
    const c = A.confine({ worktree: bound.worktree, tool, input: input.tool_input });
    if (c?.deny) return deny(c.deny);
    if (c?.input) return rewrite(c.input);
    return;
  }
  if (event === 'SubagentStop' && input.agent_id) {
    const tail = input.agent_transcript_path ? read(input.agent_transcript_path, { from: null, cap: 256 * 1024 })?.text ?? '' : '';
    const r = A.stopped({ root, agentId: input.agent_id, again: input.stop_hook_active === true, handedBack: handedBack(tail), session });
    if (r?.block) return process.stdout.write(JSON.stringify({ decision: 'block', reason: r.block }));
    if (r?.failed) await deliverFailed(A, root, r.failed);
    return;
  }
  // The main session ends a turn with a run of its own items waiting for its agent: block, at most STALL_CAP times
  // per run, then fail the run so its item takes the error path.
  if (event === 'Stop') {
    const r = A.stall({ root, sessions: owners, session });
    if (!r) return;
    for (const run of r.failed) await deliverFailed(A, root, run);
    if (r.block) process.stdout.write(JSON.stringify({ decision: 'block', reason: r.block }));
    return;
  }
  if (event === 'SubagentStart') {
    const toolUseId = A.startedRun({ root, session: input.session_id ?? null });
    const r = A.bind({ root, agentId: input.agent_id, toolUseId, agentType: input.agent_type ?? null, session, via: 'start' });
    if (r) out({ hookEventName: 'SubagentStart', additionalContext: r.context });
    return;
  }
  // After an Agent call, or a wake such as a background agent's task notification: name the runs of this session's
  // own items waiting, the ones the Stop guard checks.
  if ((event === 'PostToolUse' && tool === 'Agent' && !input.agent_id) || event === 'UserPromptSubmit') {
    const runs = A.ownedWaiting(root, owners);
    if (!runs.length) return;
    out({ hookEventName: event, additionalContext: A.waitingText(runs) });
  }
}

// A failure here must not break the session's tool call: it is reported on stderr and the hook exits 0, so the
// call goes on as if the hook were absent (and a return no hook accepted is refused by the return tool itself).
main().catch((error) => process.stderr.write(`ccp-harness actors: ${error?.message ?? error}\n`));

// Capture's handlers (plan item obs-live-capture): one Claude Code hook input in, the journal rows and blobs it
// makes out. They write nothing themselves; capture.mjs appends what they return, and the tests replay a recorded
// session through them. Rows carry hashes and sizes of what a tool was given, never the input itself; the only
// text kept is a subagent's brief and final answer, stored as blobs by content hash. docs/journal.md, "Capture
// rows", says what each row holds.
import { createHash } from 'node:crypto';
import { closeSync, fstatSync, openSync, readSync } from 'node:fs';

/** The hook events capture listens to. hooks/hooks.json registers capture.mjs on each. */
export const EVENTS = Object.freeze(['PostToolUse', 'PostToolUseFailure', 'SubagentStart', 'SubagentStop', 'UserPromptSubmit', 'Stop']);

// A transcript can be large; capture never reads more than this much of one.
export const READ_CAP = 8 * 1024 * 1024;

/**
 * { text, start }: up to `cap` bytes of a file from offset `from`, or its last `cap` bytes when `from` is null, and
 * the offset they start at. Null when the file can't be read.
 */
export function read(path, { from = null, cap }) {
  let fd;
  try {
    fd = openSync(path, 'r');
    const size = fstatSync(fd).size;
    const start = from === null ? Math.max(0, size - cap) : Math.min(from, size);
    const length = Math.min(cap, size - start);
    const buf = Buffer.alloc(length);
    readSync(fd, buf, 0, length, start);
    return { text: buf.toString('utf8'), start };
  } catch {
    return null;
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export const sha256 = (text) => createHash('sha256').update(text).digest('hex');
const bytes = (text) => Buffer.byteLength(text);

/** A blob for `text`, stored once at blobs/<sha256>, and the hash and size its rows link it by. */
const blob = (text) => ({ hash: sha256(text), bytes: bytes(text), text });

/**
 * The rows and blobs for one hook input. `read` is read() above, or a stand-in for tests; `state` is this session's
 * capture state ({ transcriptAt }: how far the last Stop read the transcript), which the Stop handler advances.
 * Returns { rows, blobs, state }; each row has kind, source, agent, payload and maybe placeholder.
 */
export function capture(input, { read, state = {} } = {}) {
  const handler = HANDLERS[input?.hook_event_name];
  if (!handler) return { rows: [], blobs: [], state };
  return { blobs: [], state, ...handler(input, { read, state }) };
}

const HANDLERS = {
  PostToolUse: (input) => {
    const brief = briefOf(input);
    return { rows: [toolCall(input, true), ...brief.rows], blobs: brief.blobs };
  },
  PostToolUseFailure: (input) => ({ rows: [toolCall(input, false)] }),
  SubagentStart: spawn,
  SubagentStop: finish,
  UserPromptSubmit: (input) => ({ rows: [wake(input)] }),
  Stop: usage,
};

function toolCall(input, ok) {
  const given = JSON.stringify(input.tool_input ?? null);
  return {
    kind: 'tool.call',
    source: { system: 'claude-code', ref: input.tool_use_id ?? `${input.hook_event_name} ${input.tool_name}` },
    agent: input.agent_id ?? null,
    payload: {
      tool: String(input.tool_name),
      inputHash: sha256(given),
      inputBytes: bytes(given),
      ms: Number.isFinite(input.duration_ms) ? input.duration_ms : null,
      ok,
    },
  };
}

// A subagent's own files sit beside its parent's transcript: <transcript without .jsonl>/subagents/agent-<id>.*
const agentFile = (input, ext) =>
  input.transcript_path ? `${input.transcript_path.replace(/\.jsonl$/, '')}/subagents/agent-${input.agent_id}${ext}` : null;

function meta(input, read) {
  const path = agentFile(input, '.meta.json');
  const got = path && read(path, { from: 0, cap: 64 * 1024 });
  try {
    return got ? JSON.parse(got.text) : {};
  } catch {
    return {};
  }
}

const textOf = (content) =>
  typeof content === 'string' ? content
    : Array.isArray(content) ? content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n') : '';

const lines = (text) => text.split('\n').flatMap((l) => {
  try {
    return l.trim() ? [JSON.parse(l)] : [];
  } catch {
    return []; // a torn last line, or the partial first line of a tail read
  }
});

// SubagentStart: the brief is the first line of the agent's transcript, which a foreground agent has written by now.
// A background agent may not have, so the spawn row's briefHash can be null; brief.stored comes from the Agent call.
function spawn(input, { read }) {
  const agentId = input.agent_id;
  const m = meta(input, read);
  const path = agentFile(input, '.jsonl');
  const first = path && read(path, { from: 0, cap: 1024 * 1024 });
  const opening = first ? lines(first.text.split('\n')[0])[0] : null;
  const brief = opening?.type === 'user' ? textOf(opening.message?.content) : '';
  return {
    rows: [{
      kind: 'agent.spawn',
      source: { system: 'claude-code', ref: m.toolUseId ?? `SubagentStart ${agentId}` },
      agent: agentId,
      payload: { agentId, type: input.agent_type ?? m.agentType ?? null, model: m.model ?? null, briefHash: brief ? sha256(brief) : null, depth: m.spawnDepth ?? null },
      ...(brief ? {} : { placeholder: 'the brief was not yet in the subagent transcript at SubagentStart; brief.stored has it' }),
    }],
  };
}

// The Agent call's own record of the brief, with the id of the agent it started: returned at once for a background
// agent, at its end for a foreground one.
function briefOf(input) {
  const agentId = input.tool_response?.agentId;
  const text = input.tool_input?.prompt;
  if (typeof agentId !== 'string' || typeof text !== 'string' || !text) return { rows: [], blobs: [] };
  const b = blob(text);
  return {
    rows: [{ kind: 'brief.stored', source: { system: 'journal', ref: `blobs/${b.hash}` }, agent: agentId, payload: { agentId, hash: b.hash, bytes: b.bytes } }],
    blobs: [b],
  };
}

// Token counts summed over assistant messages, each message once (a transcript writes one line per content block).
function tokens(entries) {
  const seen = new Set();
  const sum = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 };
  const models = new Set();
  for (const e of entries) {
    if (e.type !== 'assistant' || !e.message?.usage) continue;
    const id = e.message.id ?? e.requestId ?? e.uuid;
    if (seen.has(id)) continue;
    seen.add(id);
    const u = e.message.usage;
    sum.input += u.input_tokens ?? 0;
    sum.output += u.output_tokens ?? 0;
    sum.cacheRead += u.cache_read_input_tokens ?? 0;
    sum.cacheCreation += u.cache_creation_input_tokens ?? 0;
    if (e.message.model) models.add(e.message.model);
  }
  return { tokens: sum, models: [...models], messages: seen.size };
}

// The subagent's final answer: its SubagentHandback message when it handed one back, else its last assistant text.
function answer(entries, input) {
  let handback = null;
  let last = '';
  for (const e of entries) {
    if (e.type !== 'assistant') continue;
    for (const c of Array.isArray(e.message?.content) ? e.message.content : []) {
      if (c.type === 'tool_use' && c.name === 'SubagentHandback' && typeof c.input?.message === 'string') handback = c.input.message;
      if (c.type === 'text' && c.text) last = c.text;
    }
  }
  return handback ?? (typeof input.last_assistant_message === 'string' ? input.last_assistant_message : null) ?? last;
}

// SubagentStop: time, tokens and answer come from the agent's own transcript.
function finish(input, { read }) {
  const agentId = input.agent_id;
  const m = meta(input, read);
  const path = input.agent_transcript_path ?? agentFile(input, '.jsonl');
  const got = path && read(path, { from: null, cap: READ_CAP });
  const entries = got ? lines(got.text) : [];
  const times = entries.map((e) => Date.parse(e.timestamp)).filter(Number.isFinite);
  const { tokens: t, models } = tokens(entries);
  const text = answer(entries, input);
  const rows = [];
  const blobs = [];
  if (text) {
    const b = blob(text);
    blobs.push(b);
    rows.push({ kind: 'result.stored', source: { system: 'journal', ref: `blobs/${b.hash}` }, agent: agentId, payload: { agentId, hash: b.hash, bytes: b.bytes } });
  }
  rows.unshift({
    kind: 'agent.finish',
    source: { system: 'claude-code', ref: m.toolUseId ?? `SubagentStop ${agentId}` },
    agent: agentId,
    payload: {
      agentId,
      type: input.agent_type ?? m.agentType ?? null,
      model: models.at(-1) ?? null,
      ms: times.length ? Math.max(...times) - Math.min(...times) : null,
      tokens: t,
      resultHash: blobs[0]?.hash ?? null,
    },
    ...(got ? {} : { placeholder: 'the subagent transcript was not readable at SubagentStop' }),
  });
  return { rows, blobs };
}

// What woke the session, from the opening of the prompt text; the text itself is never kept.
export function wakeOf(prompt) {
  const reason = prompt.match(/<wake reason="([^"]+)"/)?.[1];
  if (reason) return { reason, source: 'hearth' };
  if (/^\s*<agent-message from=/.test(prompt)) return { reason: 'agent-message', source: 'subagent' };
  if (/<task-notification>/.test(prompt)) return { reason: 'task-notification', source: 'claude-code' };
  return { reason: 'prompt', source: 'user' };
}

function wake(input) {
  const prompt = typeof input.prompt === 'string' ? input.prompt : '';
  return {
    kind: 'wake',
    source: { system: 'claude-code', ref: input.prompt_id ?? `UserPromptSubmit ${input.session_id}` },
    agent: null,
    payload: { ...wakeOf(prompt), hash: sha256(prompt), bytes: bytes(prompt) },
  };
}

// Stop: the tokens of the turn are the main transcript's assistant messages since the last Stop. Cost and the
// 5-hour and 7-day usage windows reach no hook, so they stay null and the row says so.
function usage(input, { read, state }) {
  const from = Number.isInteger(state.transcriptAt) ? state.transcriptAt : null;
  const got = input.transcript_path && read(input.transcript_path, { from, cap: READ_CAP });
  // Only whole lines count, so a line still being written is read at the next Stop.
  const whole = got ? got.text.slice(0, got.text.lastIndexOf('\n') + 1) : '';
  const entries = lines(whole).filter((e) => !e.isSidechain);
  const { tokens: t, models, messages } = tokens(entries);
  return {
    rows: [{
      kind: 'turn.usage',
      source: { system: 'claude-code', ref: input.prompt_id ?? `Stop ${input.session_id}` },
      agent: null,
      payload: { tokens: t, messages, models, cost: null, fiveHour: null, sevenDay: null },
      placeholder: got
        ? 'cost and the 5-hour and 7-day usage windows do not reach a hook'
        : 'the transcript was not readable at Stop, and cost and usage windows do not reach a hook',
    }],
    state: got ? { ...state, transcriptAt: got.start + bytes(whole) } : state,
  };
}

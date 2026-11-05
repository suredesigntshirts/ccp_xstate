// Verifier's harness for fix-agent-finish-ms: builds subagent transcripts of real shape and pipes hook inputs into a
// checkout's real capture hook (plugins/harness/scripts/capture.mjs) with CCP_HARNESS_DIR at a fresh harness folder.
// Written without reading the builder's tests. `repo` is a checkout path, so the same inputs run at the head and at main.
import { spawnSync, execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const HEAD = join(HERE, '..', '..');
export const OLD = '2026-10-30T10:13:50.430Z'; // written_at of the person's relayed "User is not around" message
const REAL = join(HEAD, 'verify', 'probe-plugin-agents-thread', 'evidence', 'agent-adda18087b10e0b3a.jsonl');
export const SESSION = '5e551011-0000-4000-8000-00000000f1a5';

/** The 8 user and assistant rows of a real subagent transcript (probe-plugin-agents-thread's verifier agent). */
export const realRows = () => readFileSync(REAL, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
const iso = (ms) => new Date(ms).toISOString();

/** An attachment row in the shape Claude Code writes them (copied from a live transcript's fields). */
export function attachment(timestamp, agentId, kind = 'deferred_tools_delta') {
  return {
    parentUuid: null, isSidechain: true, agentId,
    attachment: kind === 'deferred_tools_delta' ? { type: kind, addedNames: ['WebFetch', 'WebSearch'] } : { type: kind, date: '2026-11-05' },
    type: 'attachment', uuid: `att-${Math.random().toString(16).slice(2)}`, timestamp,
    userType: 'external', entrypoint: 'remote_projects', cwd: '/home/user/ccp_xstate', sessionId: SESSION, version: '2.1.318',
  };
}

/** A user row like the relayed message's: a person's words stamped with when they were written. */
export function relayedUser(timestamp, agentId) {
  return {
    parentUuid: null, isSidechain: true, agentId, type: 'user', timestamp, userType: 'external', uuid: `rel-${Math.random().toString(16).slice(2)}`,
    message: { role: 'user', content: 'User is not around. You will have to enable things and answer your own questions.' },
  };
}

/**
 * The old-entry transcript: the real 8 rows, with an attachment row and a user row stamped OLD after the brief, an
 * attachment at the run, and one trailing attachment a minute after the last message (which must not count either).
 */
export function oldEntryTranscript() {
  const rows = realRows();
  const id = rows[0].agentId;
  const t0 = Date.parse(rows[0].timestamp);
  const last = Date.parse(rows.at(-1).timestamp);
  const out = [rows[0], attachment(OLD, id), relayedUser(OLD, id), attachment(iso(t0 + 50), id, 'date'), ...rows.slice(1), attachment(iso(last + 60_000), id, 'date')];
  return { rows: out, agentId: id, expected: last - t0 };
}

const install = (repo, dir) =>
  execFileSync(process.execPath, [join(repo, 'plugins', 'harness', 'scripts', 'install.mjs')], { env: { PATH: process.env.PATH, CCP_HARNESS_DIR: dir } });

/** A fresh harness folder installed by `repo`'s install script, and a project folder for transcripts. */
export function world(repo) {
  const root = mkdtempSync(join(tmpdir(), 'verify-finish-ms-'));
  const harness = join(root, 'harness');
  mkdirSync(harness);
  install(repo, harness);
  mkdirSync(join(harness, 'journal', 'sessions'), { recursive: true });
  const project = join(root, 'project');
  mkdirSync(join(project, SESSION, 'subagents'), { recursive: true });
  writeFileSync(join(project, `${SESSION}.jsonl`), '');
  return { root, harness, project, transcript: join(project, `${SESSION}.jsonl`) };
}

/** Writes a subagent's transcript (rows or raw text) and meta beside the parent's transcript. Returns its path. */
export function writeAgent(w, agentId, rows, metaJson = { agentType: 'general-purpose', isBuiltIn: true }) {
  const path = join(w.project, SESSION, 'subagents', `agent-${agentId}.jsonl`);
  writeFileSync(path, typeof rows === 'string' ? rows : rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  writeFileSync(join(w.project, SESSION, 'subagents', `agent-${agentId}.meta.json`), JSON.stringify(metaJson));
  return path;
}

export const startInput = (w, agentId, type = 'general-purpose') =>
  ({ session_id: SESSION, transcript_path: w.transcript, cwd: '/home/user/ccp_xstate', agent_id: agentId, agent_type: type, hook_event_name: 'SubagentStart' });
export const stopInput = (w, agentId, path, type = 'general-purpose') => ({
  session_id: SESSION, transcript_path: w.transcript, cwd: '/home/user/ccp_xstate', permission_mode: 'auto', agent_id: agentId, agent_type: type,
  hook_event_name: 'SubagentStop', stop_hook_active: false, agent_transcript_path: path, background_tasks: [], session_crons: [],
});

/** Pipes one hook input into `repo`'s real capture hook, as Claude Code runs it. */
export function hook(repo, w, input) {
  const env = { PATH: process.env.PATH, CCP_HARNESS_DIR: w.harness, CCP_HARNESS_STATE: join(w.root, 'state') };
  const r = spawnSync(process.execPath, [join(repo, 'plugins', 'harness', 'scripts', 'capture.mjs')], { input: JSON.stringify(input), env, encoding: 'utf8', timeout: 20_000 });
  if (r.status !== 0 || r.stdout || r.stderr) throw new Error(`capture hook: ${r.status} ${r.stdout} ${r.stderr}`);
}

/** Every row in the harness folder's session journals, in file order. */
export function rows(w) {
  const dir = join(w.harness, 'journal', 'sessions');
  return readdirSync(dir).sort().flatMap((f) => readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)));
}

export function blobs(w) {
  const dir = join(w.harness, 'journal', 'blobs');
  return existsSync(dir) ? readdirSync(dir).sort().map((h) => ({ hash: h, text: readFileSync(join(dir, h), 'utf8') })) : [];
}

/** Runs one subagent's start and stop through `repo`'s hook and returns its agent.finish row. */
export function finishOf(repo, rowsOrText, agentId = 'a0000000000000001') {
  const w = world(repo);
  const path = writeAgent(w, agentId, rowsOrText);
  hook(repo, w, startInput(w, agentId));
  hook(repo, w, stopInput(w, agentId, path));
  const finish = rows(w).filter((r) => r.kind === 'agent.finish');
  if (finish.length !== 1) throw new Error(`expected one agent.finish, got ${finish.length}`);
  return finish[0];
}

/** Rows with the fields that differ run to run (ids, times, paths, hook timing) taken out, for head-vs-main compare. */
export function norm(list, root) {
  const drop = new Set(['id', 'at', 'release']);
  const ids = new Map(list.map((r, i) => [r.id, `#${i}`]));
  const walk = (v) => {
    if (typeof v === 'string' && ids.has(v)) return ids.get(v);
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).filter(([k]) => !drop.has(k)).map(([k, x]) => [k, walk(x)]));
    return typeof v === 'string' && root ? v.replaceAll(root, '<root>') : v;
  };
  return list.map((r) => {
    const out = walk(r);
    if (r.kind === 'hook.run') out.payload = { ...out.payload, ms: '<ms>' };
    return out;
  });
}

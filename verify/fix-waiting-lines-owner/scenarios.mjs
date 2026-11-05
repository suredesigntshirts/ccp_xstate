// The verifier's scenarios for fix-waiting-lines-owner, run on one checkout: `node scenarios.mjs <checkout>` prints
// them as JSON. Run on main (3be0740) it gave evidence/main-scenarios.json; the tests run it on this checkout.
// Sessions: A and B own one quick-fix item each (a-1, b-1), started by bin/host.js; U owns u-1 under the cloud URL
// form (start --session https://claude.ai/code/session_verifyU), seen by a hook whose session_id is a local id and
// whose CLAUDE_CODE_REMOTE_SESSION_ID is cse_verifyU; C owns nothing.
import { pathToFileURL } from 'node:url';
import { project, norm, engineOf, cloudUrl } from './lib.mjs';

const CSE = 'cse_verifyU';
const ctx = (o) => o?.hookSpecificOutput?.additionalContext ?? null;

/** UserPromptSubmit and PostToolUse-of-Agent output for each asker, on one root holding a-1 (A), b-1 (B), u-1 (U). */
export function lines(repo) {
  const p = project(repo);
  p.start('a-1', 'sess-A');
  p.start('b-1', 'sess-B');
  p.start('u-1', cloudUrl(CSE));
  const askers = { A: ['sess-A', ''], B: ['sess-B', ''], C: ['sess-C', ''], U: ['local-U', CSE], 'A+cloud': ['sess-A', CSE] };
  const out = {};
  for (const [name, [id, cse]] of Object.entries(askers)) out[name] = { wake: p.wake(id, cse), afterAgent: p.afterAgent(id, cse) };
  return out;
}

/** stall(), cannotStart() and the Stop hook, each on its own root, with the journal rows they leave. */
export async function stalls(repo) {
  const A = await engineOf(repo);
  const out = {};
  // Engine calls direct.
  {
    const p = project(repo);
    p.start('a-1', 'sess-A');
    p.start('b-1', 'sess-B');
    const calls = [
      ['stall C', () => A.stall({ root: p.root, sessions: ['sess-C', 'sess-C'], session: 'sess-C' })],
      ['stall A 1', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-A'], session: 'sess-A' })],
      ['stall A 2', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-A'], session: 'sess-A' })],
      ['stall A 3', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-A'], session: 'sess-A' })],
      ['stall B 1', () => A.stall({ root: p.root, sessions: ['sess-B'], session: 'sess-B' })],
      ['stall AB', () => A.stall({ root: p.root, sessions: ['sess-A', 'sess-B'], session: 'sess-A' })],
      ['cannotStart no prompt', () => A.cannotStart({ root: p.root, prompt: 'ccp-run b-1:0.brief', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart no reason', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: <why>', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart unknown', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start z-9:0.brief: x', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart wrong session', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: no Agent', sessions: ['sess-A'], session: 'sess-A' })],
      ['cannotStart owner', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: no Agent', sessions: ['sess-B'], session: 'sess-B' })],
      ['cannotStart again', () => A.cannotStart({ root: p.root, prompt: 'ccp-cannot-start b-1:0.brief: again', sessions: ['sess-B'], session: 'sess-B' })],
      ['stall B after', () => A.stall({ root: p.root, sessions: ['sess-B'], session: 'sess-B' })],
    ];
    out.engine = {};
    for (const [k, f] of calls) out.engine[k] = norm(f(), p.base);
    out.engineRows = { 'a-1': norm(await p.rows('a-1'), p.base), 'b-1': norm(await p.rows('b-1'), p.base) };
    out.engineFiles = { 'a-1:0.brief': p.files('a-1:0.brief'), 'b-1:0.brief': p.files('b-1:0.brief'), failedA: norm(p.json('a-1:0.brief', 'failed.json'), p.base), failedB: norm(p.json('b-1:0.brief', 'failed.json'), p.base) };
  }
  // The Stop hook, and cannot-start through the hook.
  {
    const p = project(repo);
    p.start('a-1', 'sess-A');
    p.start('b-1', 'sess-B');
    p.start('u-1', cloudUrl(CSE));
    const steps = [
      ['Stop C', () => p.stop('sess-C')],
      ['Stop A 1', () => p.stop('sess-A')],
      ['Stop A 2', () => p.stop('sess-A', true)],
      ['Stop B 1', () => p.stop('sess-B')],
      ['Stop U 1', () => p.stop('local-U', false, CSE)],
      ['Stop A 3', () => p.stop('sess-A', true)],
      ['Stop A 4', () => p.stop('sess-A')],
      ['cannot-start B from A', () => p.agent('ccp-cannot-start b-1:0.brief: none', 'sess-A', 'tu-c1')],
      ['cannot-start B from B', () => p.agent('ccp-cannot-start b-1:0.brief: none', 'sess-B', 'tu-c2')],
      ['Stop B 2', () => p.stop('sess-B', true)],
      ['Stop U 2', () => p.stop('local-U', true, CSE)],
    ];
    out.hook = {};
    for (const [k, f] of steps) out.hook[k] = norm(f(), p.base);
    out.hookRows = Object.fromEntries(await Promise.all(['a-1', 'b-1', 'u-1'].map(async (i) => [i, norm(await p.rows(i), p.base)])));
    out.hookFiles = { a: p.files('a-1:0.brief'), b: p.files('b-1:0.brief'), u: p.files('u-1:0.brief') };
  }
  return out;
}

/** spawn() direct and a ccp-run PreToolUse through the hook, including from a session that doesn't own the item. */
export async function spawns(repo) {
  const A = await engineOf(repo);
  const out = {};
  {
    const p = project(repo);
    p.start('a-1', 'sess-A');
    p.start('b-1', 'sess-B');
    const calls = [
      ['not a run', () => A.spawn({ root: p.root, prompt: 'hello', toolUseId: 't0', session: 'sess-A' })],
      ['unknown run', () => A.spawn({ root: p.root, prompt: 'ccp-run z-9:0.brief', toolUseId: 't1', session: 'sess-A' })],
      ['own run', () => A.spawn({ root: p.root, prompt: 'ccp-run a-1:0.brief', toolUseId: 't2', session: 'sess-A' })],
      ['own run again', () => A.spawn({ root: p.root, prompt: 'ccp-run a-1:0.brief', toolUseId: 't3', session: 'sess-A' })],
      ["other's run", () => A.spawn({ root: p.root, prompt: 'ccp-run b-1:0.brief', toolUseId: 't4', session: 'sess-A' })],
    ];
    out.engine = {};
    for (const [k, f] of calls) out.engine[k] = norm(f(), p.base);
    out.engineSpawn = { a: norm(p.json('a-1:0.brief', 'spawn.json'), p.base), b: norm(p.json('b-1:0.brief', 'spawn.json'), p.base) };
  }
  {
    const p = project(repo);
    p.start('a-1', 'sess-A');
    p.start('b-1', 'sess-B');
    const steps = [
      ['own ccp-run', () => p.agent('ccp-run a-1:0.brief', 'sess-A', 'tu-1')],
      ['own ccp-run again', () => p.agent('ccp-run a-1:0.brief', 'sess-A', 'tu-2')],
      ["other's ccp-run", () => p.agent('ccp-run b-1:0.brief', 'sess-A', 'tu-3')],
      ['unknown ccp-run', () => p.agent('ccp-run z-9:0.brief', 'sess-A', 'tu-4')],
      ['plain Agent', () => p.agent('look around', 'sess-A', 'tu-5')],
      ['wake A after', () => p.wake('sess-A')],
      ['wake B after', () => p.wake('sess-B')],
    ];
    out.hook = {};
    for (const [k, f] of steps) out.hook[k] = norm(f(), p.base);
    out.hookSpawn = { a: norm(p.json('a-1:0.brief', 'spawn.json'), p.base), b: norm(p.json('b-1:0.brief', 'spawn.json'), p.base) };
    out.hookRows = { 'a-1': norm(await p.rows('a-1'), p.base), 'b-1': norm(await p.rows('b-1'), p.base) };
  }
  return out;
}

export async function scenarios(repo) {
  return { lines: lines(repo), stalls: await stalls(repo), spawns: await spawns(repo) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await scenarios(process.argv[2]), null, 1));

// Expect one-owner and split-by-knowledge: only run/store.js touches the run folder's lifecycle files and the pointer
// files; the hooks ask the store for a run's state; actors.js splits into the store, worktree.js, accept.js and
// supervise.js and still exports every name it exported at main (evidence/main/exports.json), with the same values.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportsOf } from './scenario.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const files = (dir) => readdirSync(dir).flatMap((n) => (statSync(join(dir, n)).isDirectory() ? (n === 'node_modules' ? [] : files(join(dir, n))) : [join(dir, n)]));
const src = (dir) => files(join(REPO, dir)).filter((p) => /\.m?js$/.test(p));
const read = (p) => readFileSync(join(REPO, p), 'utf8');
const LIFECYCLE = /\b(run|spawn|agent|result|failed|sent-back)\.json\b|\b(spawnFile|agentFile)\b|'spawns'|'agents'/;

test('one-owner: under packages/engine/src and packages/journal/src, only run/store.js names the lifecycle files or pointers', () => {
  const hits = [];
  for (const p of [...src('packages/engine/src'), ...src('packages/journal/src')]) {
    const rel = relative(REPO, p);
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (LIFECYCLE.test(l)) hits.push(`${rel}:${i + 1}`);
    });
  }
  const outside = hits.filter((h) => !h.startsWith('packages/engine/src/run/store.js:'));
  // names.js only defines the pointer paths (the store imports them); nothing else names them.
  assert.deepEqual(outside.map((h) => h.replace(/:\d+$/, '')), ['packages/engine/src/names.js', 'packages/engine/src/names.js']);
  for (const h of outside) assert.match(read(h.replace(/:\d+$/, '')).split('\n')[Number(h.split(':').pop()) - 1], /^export const (agentFile|spawnFile) = /);
  assert.ok(hits.filter((h) => h.startsWith('packages/engine/src/run/store.js:')).length >= 8);
  // Only the store imports the pointer paths.
  const importers = src('packages/engine/src').filter((p) => /import \{[^}]*\b(agentFile|spawnFile)\b[^}]*\} from/.test(readFileSync(p, 'utf8'))).map((p) => relative(REPO, p));
  assert.deepEqual(importers, ['packages/engine/src/run/store.js']);
});

test('one-owner: outside the store, no engine module calls fs on a run folder: no existsSync, writeOnce or fs write of the six files', () => {
  for (const f of ['actors.js', 'run/accept.js', 'run/supervise.js', 'run/worktree.js']) {
    const text = read(`packages/engine/src/${f}`);
    assert.equal(/writeOnce/.test(text), false, `${f}: writeOnce`);
    assert.equal(/\brenameSync\b/.test(text), false, `${f}: renameSync`);
    const exists = [...text.matchAll(/existsSync\(([^)]*)\)/g)].map((m) => m[1]);
    assert.ok(exists.every((a) => a === 'worktree'), `${f}: existsSync(${exists.join(', ')})`);
  }
  // actors.js reads and writes only the prompt, context.md and stage.json itself.
  const actors = read('packages/engine/src/actors.js');
  const writes = [...actors.matchAll(/(writeFileSync|writeJson|readJson|readFileSync)\(([^,)]*)/g)].map((m) => `${m[1]}(${m[2]}`);
  assert.deepEqual(writes, ['readJson(file', 'writeJson(file', 'writeFileSync(promptFile(root', 'writeFileSync(join(dir', 'writeJson(join(dir', 'readFileSync(promptFile(root']);
  assert.match(actors, /const file = join\(runDir\(host\.root, effect\.id\), 'stage\.json'\);/);
  assert.match(actors, /writeFileSync\(join\(dir, 'context\.md'\), run\.context\);/);
  assert.match(actors, /writeJson\(join\(dir, 'stage\.json'\)/);
});

test('one-owner: in plugins/harness/scripts the only uses are return-tool.mjs reading result.json and capture.mjs reading the agent pointer', () => {
  const hits = [];
  for (const p of files(join(REPO, 'plugins/harness/scripts')).filter((p) => /\.m?js$/.test(p) && !p.includes('/test/'))) {
    readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
      if (/\b(run|spawn|agent|result|failed|sent-back)\.json\b|names\.(agentFile|spawnFile)|writeFileSync|writeJson/.test(l) && !/^\s*\/\//.test(l)) hits.push(`${relative(REPO, p)}:${i + 1}: ${l.trim()}`);
    });
  }
  const code = hits.filter((h) => /readFileSync|writeFileSync|writeJson/.test(h));
  const lifecycle = code.filter((h) => /(run|spawn|agent|result|failed|sent-back)\.json|agentFile|spawnFile/.test(h));
  assert.deepEqual(lifecycle.map((h) => h.replace(/:\d+:/, ':')), [
    "plugins/harness/scripts/capture.mjs: b = JSON.parse(readFileSync(names.agentFile(journalDir(), agentId), 'utf8'));",
    "plugins/harness/scripts/return-tool.mjs: stored = JSON.parse(readFileSync(join(dir, 'result.json'), 'utf8'));"
  ]);
});

test('one-owner: each hook asks the store for the run\'s state', () => {
  const body = (file, fn) => {
    const text = read(`packages/engine/src/${file}`);
    const at = text.search(new RegExp(`export (async )?function ${fn}\\(`));
    assert.ok(at >= 0, `${file} ${fn}`);
    const rest = text.slice(at);
    return rest.slice(0, rest.search(/\n}\n/));
  };
  assert.match(body('actors.js', 'spawn'), /answerOf\('spawn', state\(root, run\)\)/);
  assert.match(body('actors.js', 'spawn'), /transition\(root, run, 'spawn'/);
  assert.match(body('actors.js', 'bind'), /transition\(root, run, 'bind'/);
  assert.match(body('actors.js', 'bindLate'), /boundRun\(root, agentId\)/);
  assert.match(body('actors.js', 'bindLate'), /verifyBinding\(root, agentId\)/);
  assert.match(body('actors.js', 'startedRun'), /unboundSpawns\(root\)/);
  assert.match(body('actors.js', 'resultsOf'), /resultOf\(host\.root, run\.id\)/);
  assert.match(body('actors.js', 'resultsOf'), /failureOf\(host\.root, run\.id\)/);
  assert.match(body('actors.js', 'waiting'), /waitingRecords\(root, item\)/);
  assert.match(body('actors.js', 'ownedWaiting'), /ownedRecords\(root, sessions\)/);
  assert.match(body('actors.js', 'prepare'), /recordOf\(root, effect\.id\)/);
  assert.match(body('actors.js', 'prepare'), /transition\(root, run, 'prepare', run\)/);
  const acc = body('run/accept.js', 'accept');
  assert.match(acc, /bindingOf\(root, run\)/);
  assert.match(acc, /answerOf\('return', now, root, run\)/);
  assert.match(acc, /const now = state\(root, run\)/);
  assert.match(acc, /transition\(root, run, 'return'/);
  assert.match(acc, /transition\(root, run, 'fail'/);
  assert.match(acc, /spend\(root, run, 'refused'\)/);
  const sup = read('packages/engine/src/run/supervise.js');
  assert.match(sup, /const now = state\(root, run\);\n\s*if \(now === 'returned' \|\| now === 'failed'\) return null;/);
  assert.match(body('run/supervise.js', 'cannotStart'), /answerOf\('cannot-start', state\(root, run\)\)/);
  assert.match(body('run/supervise.js', 'stall'), /spent\(root, run, 'stalled'\)/);
  assert.match(body('run/supervise.js', 'stall'), /ownedRecords\(root, sessions\)/);
  assert.match(sup, /transition\(root, run, 'send-back'/);
  assert.match(sup, /transition\(root, run, 'fail'/);
});

test('split-by-knowledge: worktree.js, accept.js and supervise.js hold their parts; only worktree.js runs git worktree; actors.js under 450 lines', () => {
  const wt = read('packages/engine/src/run/worktree.js');
  for (const f of ['export function githubOf', 'export function rebuildStart', 'function freeBranch', "'worktree', 'add'"]) assert.ok(wt.includes(f), f);
  const acc = read('packages/engine/src/run/accept.js');
  for (const f of ['export async function accept', 'export function agrees', 'export function differences', 'function refsIn', 'function hintOf', 'export const REFUSAL_CAP', 'export function refusalText']) assert.ok(acc.includes(f), f);
  const sup = read('packages/engine/src/run/supervise.js');
  for (const f of ['export function handback', 'export function stopped', 'export function stall', 'export function cannotStart', 'export const STALL_CAP', 'export const CANNOT_START', 'export const cannotStartPrompt', 'export const stallText']) assert.ok(sup.includes(f), f);
  const gitWorktree = [...src('packages'), ...src('plugins')].filter((p) => !p.includes('/test/') && /'worktree',\s*'(add|list|remove|prune|move)'|\['worktree'/.test(readFileSync(p, 'utf8'))).map((p) => relative(REPO, p));
  assert.deepEqual(gitWorktree, ['packages/engine/src/run/worktree.js']);
  const lines = read('packages/engine/src/actors.js').split('\n').length;
  assert.ok(lines < 450, `${lines} lines`);
});

test('split-by-knowledge: actors.js exports every name it exported at main, each with the same type and value', async () => {
  const main = JSON.parse(readFileSync(join(HERE, 'evidence', 'main', 'exports.json'), 'utf8'));
  const head = await exportsOf(REPO);
  assert.deepEqual(Object.keys(main).filter((k) => !(k in head)), []);
  for (const [k, v] of Object.entries(main)) assert.deepEqual(head[k], v, k);
  console.log(`# main exports ${Object.keys(main).length}; head adds: ${Object.keys(head).filter((k) => !(k in main)).join(', ') || 'none'}`);
});

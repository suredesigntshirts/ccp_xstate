// Expect one-budget: the limits are declared once, in store.js's BUDGET, and the caps are read from it; a run main
// left with refusals and a stall block already journalled (and no attempts in run.json) continues from those counts
// at the head; and no hook outside the store reads the journal to count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cont, engineOf, unpack } from './scenario.mjs';
import { BUDGET, spent } from '../../packages/engine/src/run/store.js';
import { REFUSAL_CAP } from '../../packages/engine/src/run/accept.js';
import { STALL_CAP } from '../../packages/engine/src/run/supervise.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..', '..');
const SRC = join(REPO, 'packages/engine/src');
const MAIN = JSON.parse(readFileSync(join(HERE, 'evidence', 'main', 'trace.json'), 'utf8'));
const strip = (x) => JSON.parse(JSON.stringify(x, (k, v) => (k === 'attempts' ? undefined : v)));
const code = (f) => readFileSync(join(SRC, f), 'utf8').split('\n').filter((l) => !/^\s*(\/\/|\*|\/\*\*)/.test(l));

test('one-budget: BUDGET is { refused: 10, sentBack: 1, stalled: 2 } and the caps are read from it', () => {
  assert.deepEqual({ ...BUDGET }, { refused: 10, sentBack: 1, stalled: 2 });
  assert.ok(Object.isFrozen(BUDGET));
  assert.equal(REFUSAL_CAP, BUDGET.refused);
  assert.equal(STALL_CAP, BUDGET.stalled);
  assert.ok(code('run/accept.js').some((l) => /REFUSAL_CAP = BUDGET\.refused/.test(l)));
  assert.ok(code('run/supervise.js').some((l) => /STALL_CAP = BUDGET\.stalled/.test(l)));
});

test('one-budget: no number 10, 1 or 2 is a limit anywhere in the run modules or actors.js but BUDGET', () => {
  const hits = [];
  for (const f of ['actors.js', 'run/store.js', 'run/accept.js', 'run/supervise.js', 'run/worktree.js']) {
    code(f).forEach((l, i) => {
      const bare = l.replace(/'[^']*'|`[^`]*`|"[^"]*"/g, "''");
      // A comparison or assignment with 10, 1 or 2 is a limit; JSON indentation (null, 2), slices and indexes are not.
      if (/(<|>|<=|>=|===|!==|==|=)\s*(10|1|2)\b(?!\.)/.test(bare) && !/null, 2\)/.test(bare)) hits.push(`${f}: ${l.trim()}`);
      if (/\b(10|2)\b/.test(bare) && !/null, 2\)/.test(bare) && !/BUDGET = /.test(bare)) hits.push(`${f} (any 10 or 2): ${l.trim()}`);
    });
  }
  // Not limits: how many unbound Agent calls startedRun found, a hint's split after ': ', and the regexp's second group.
  assert.deepEqual(hits, [
    'actors.js: return open.length === 1 ? open[0].toolUseId : null;',
    "run/accept.js (any 10 or 2): return render('refusal-hint', { field: h.slice(0, at), description: h.slice(at + 2) });",
    "run/supervise.js (any 10 or 2): if (!m || m[2] === '<why>') return { deny: render('cannot-start-no-reason', { prompt: cannotStartPrompt('<run>') }) };"
  ]);
  assert.equal(code('run/store.js').filter((l) => /refused: 10, sentBack: 1, stalled: 2/.test(l)).length, 1);
  // The send-back is compared with BUDGET.sentBack, not with a 1.
  assert.ok(code('run/supervise.js').some((l) => /spent\(root, run, 'sentBack'\) >= BUDGET\.sentBack/.test(l)));
});

test('one-budget: outside the store, no run module reads the journal (readFile, itemRows, resultRefusals) to count', () => {
  const reads = [];
  for (const f of ['actors.js', 'run/accept.js', 'run/supervise.js', 'run/worktree.js']) {
    code(f).forEach((l) => {
      if (/\breadFile\(|\breadAll\(|journal\/src/.test(l)) reads.push(`${f}: ${l.trim()}`);
      if (/\b(itemRows|resultRefusals)\(/.test(l)) reads.push(`${f}: ${l.trim()}`);
    });
  }
  // What remains: actors.js hands the item's rows to the stage record (not a count), and accept lists the refusals
  // in the refusal-cap message once the count from run.json reaches the cap.
  assert.deepEqual(reads.map((r) => r.replace(/\s+/g, ' ')), [
    'actors.js: if (record && !record.finished) writeJson(file, endRecord(record, host.spec, row, itemRows(host.root, host.item)));',
    'actors.js: const rows = itemRows(root, item);',
    'run/accept.js: const list = resultRefusals(root, run).map((r) => r.payload).map((r, i) => render(\'refusal-cap-item\', { n: i + 1, rule: String(r.rule), reason: String(r.reason) }));'
  ]);
  for (const f of ['run/accept.js', 'run/supervise.js']) assert.equal(code(f).some((l) => /\.length/.test(l) && /resultRefusals|itemRows|stall/.test(l)), false, f);
});

test('one-budget: a root main left with 7 refusals and 1 stall block (no attempts) continues at the head as at main', async () => {
  const root = join(tmpdir(), 'verify-rls-cont', 'root');
  rmSync(dirname(root), { recursive: true, force: true });
  unpack(JSON.parse(readFileSync(join(HERE, 'evidence', 'main', 'pre.json'), 'utf8')), root);
  const runJson = (item) => JSON.parse(readFileSync(join(root, 'items', item, 'runs', '0.brief', 'run.json'), 'utf8'));
  assert.equal(runJson('v-1').attempts, undefined);
  assert.equal(runJson('v-2').attempts, undefined);
  // The hooks pass spent() the run's record; the journal fallback reads its item and run from it.
  assert.equal(spent(root, runJson('v-1'), 'refused'), 7);
  assert.equal(spent(root, runJson('v-2'), 'stalled'), 1);
  assert.equal(spent(root, runJson('v-1'), 'sentBack'), 0);
  const E = await engineOf(REPO);
  const got = await cont(E, root);
  assert.deepEqual(strip(got), strip(MAIN.cont));
  // refuse 8, 9 count on; 10 fails the run; 11 is already-failed. Stall 2 blocks, 3 fails, 4 is nothing.
  assert.deepEqual(got.map((s) => [s.label, s.ret?.fix?.count ?? null, s.ret?.failed ?? null]).slice(0, 4), [['refuse 8', 8, null], ['refuse 9', 9, null], ['refuse 10', 10, 'v-1:0.brief'], ['refuse 11', null, null]]);
  assert.match(got[1 + 3].ret.block, /Block 2 of 2\./);
  assert.deepEqual(got[5].ret.failed, ['v-2:0.brief']);
  assert.equal(got[6].ret, null);
  assert.deepEqual(runJson('v-1').attempts, { refused: 10 });
  assert.deepEqual(runJson('v-2').attempts, { stalled: 2 });
  const listed = readdirSync(join(root, 'items', 'v-1', 'runs', '0.brief')).sort();
  assert.ok(listed.includes('failed.json'), listed.join());
});

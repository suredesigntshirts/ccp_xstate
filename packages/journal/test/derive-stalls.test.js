// The stalls view (plan item fix-waiting-run-stall): how often a session ended a turn with its run waiting, and what
// came of each such run. Rows shaped as the stall guard (packages/engine/src/actors.js stall, cannotStart) and the
// actor hooks (brief.stored, agent.spawn) write them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stalls } from '../src/derive/stalls.js';
import { append } from '../src/index.js';

let n = 0;
const at = (m) => `2026-11-05T10:${String(m).padStart(2, '0')}:00.000Z`;
const row = (kind, run, m, payload = {}) => ({
  id: `r${++n}`, at: at(m), kind, session: 's', release: '0.2.0', item: run.split(':')[0], state: null, agent: null,
  source: { system: 'hook', ref: run }, payload: { run, actor: 'brief', ...payload }
});
const brief = (run, m) => row('brief.stored', run, m);
const block = (run, m, count) => row('refusal', run, m, { rule: 'stall', outcome: 'blocked', count, cap: 2 });
const failed = (run, m, rule) => row('refusal', run, m, { rule, outcome: 'failed' });
const spawn = (run, m) => row('agent.spawn', run, m);

const rows = [
  brief('a:0.brief', 0), spawn('a:0.brief', 1), // never blocked
  brief('b:0.brief', 0), block('b:0.brief', 2, 1), spawn('b:0.brief', 3), // blocked once, then started
  brief('c:0.brief', 0), block('c:0.brief', 2, 1), block('c:0.brief', 4, 2), failed('c:0.brief', 6, 'stall-cap'),
  brief('d:0.brief', 0), failed('d:0.brief', 1, 'cannot-start'),
  row('refusal', 'a:0.brief', 5, { rule: 'schema', outcome: 'denied' }) // another rule counts for nothing here
];

test('stalls: counts, the rate and a line per run', () => {
  const view = stalls(rows);
  const { runs, ...totals } = view;
  assert.deepEqual(totals, { prepared: 4, blocked: 2, blocks: 3, startedAfterBlock: 1, failedAtCap: 1, cannotStart: 1, rate: 0.5 });
  assert.deepEqual(runs.map((r) => [r.run, r.blocks, r.startedAfterBlock, r.failed]), [
    ['a:0.brief', 0, false, null],
    ['b:0.brief', 1, true, null],
    ['c:0.brief', 2, false, 'stall-cap'],
    ['d:0.brief', 0, false, 'cannot-start']
  ]);
});

test('stalls: a row read twice counts once; a spawn before the first block is no start after it; none prepared is rate 0', () => {
  assert.equal(stalls([...rows, ...rows]).blocks, 3);
  const early = [brief('e:0.brief', 0), spawn('e:0.brief', 1), block('e:0.brief', 2, 1)];
  assert.equal(stalls(early).startedAfterBlock, 0);
  assert.equal(stalls([]).rate, 0);
});

test('derive.js stalls prints the view from a journal folder', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stalls-'));
  for (const r of rows) append(join(dir, 'x.jsonl'), r);
  const bin = fileURLToPath(new URL('../bin/derive.js', import.meta.url));
  const out = JSON.parse(execFileSync(process.execPath, [bin, 'stalls', '--journal', dir], { encoding: 'utf8' }));
  const { runs, ...totals } = out;
  assert.deepEqual(totals, { prepared: 4, blocked: 2, blocks: 3, startedAfterBlock: 1, failedAtCap: 1, cannotStart: 1, rate: 0.5 });
});

// Expect not-a-contract-change: the freeze gate, run in a temp repo on a PR that only adds reader_effort and status
// done to an item whose verify/<item>/verdict.json exists at the base, passes; the same PR that also changes one
// Expect check is refused naming the item. The temp repo's base holds a copy of the head's plan/, scripts/ and
// package.json, with the item set to doing and its verdict file added.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { joinItem, read, splitItem, tempRepo } from './lib.mjs';

const ID = 'clean-room-install-test';
const PATH = `plan/items/${ID}.md`;
const { head: HEAD, rest: REST } = splitItem(read(PATH));
const EFFORT = { pr: 7, files: 3, exports_added: 0, exports_removed: 0, reader_lines: 12,
  added: { code: 4, tests: 2, verifier: 3, evidence: 5, docs: 1 },
  removed: { code: 1, tests: 0, verifier: 0, evidence: 0, docs: 1 } };

function pr(t, change) {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'package.json'] });
  const base = r.commit({
    [PATH]: joinItem({ ...HEAD, status: 'doing' }, REST),
    [`verify/${ID}/verdict.json`]: JSON.stringify({ item: ID }) + '\n',
  }, 'base: the item is doing and verified');
  r.branch(`replan/${ID}-done`);
  r.commit({ [PATH]: joinItem(change({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: EFFORT }), REST) },
    'done replan');
  const out = r.gate('freeze', { labels: ['replan'], branch: `replan/${ID}-done` }, base);
  t.diagnostic(`exit ${out.status}: ${out.out.trim().split('\n').join(' / ')}`);
  return out;
}

test('status done, done_on and reader_effort alone pass the freeze gate', (t) => {
  const out = pr(t, (h) => h);
  assert.equal(out.status, 0, out.out);
});

test('the same PR changing one Expect check as well is refused, naming the item', (t) => {
  const out = pr(t, (h) => ({ ...h, expect: h.expect.map((e, i) => (i === 0 ? { ...e, check: `${e.check}, and more` } : e)) }));
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, new RegExp(ID));
});

test('a changed reader_effort on an item already done passes too (it is outside the contract)', (t) => {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'package.json'] });
  const base = r.commit({
    [PATH]: joinItem({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: EFFORT }, REST),
    [`verify/${ID}/verdict.json`]: JSON.stringify({ item: ID }) + '\n',
  }, 'base');
  r.branch('replan/fix-effort');
  r.commit({ [PATH]: joinItem({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: { ...EFFORT, reader_lines: 13 } }, REST) });
  const out = r.gate('freeze', { labels: ['replan'], branch: 'replan/fix-effort' }, base);
  assert.equal(out.status, 0, out.out);
});

test('control: with contract() freezing reader_effort again, the done PR is refused, so the pass comes from contract()', (t) => {
  const r = tempRepo(t, { copy: ['plan', 'scripts', 'package.json'] });
  const base = r.commit({
    [PATH]: joinItem({ ...HEAD, status: 'doing' }, REST),
    [`verify/${ID}/verdict.json`]: JSON.stringify({ item: ID }) + '\n',
  }, 'base');
  r.branch(`replan/${ID}-done`);
  r.commit({ [PATH]: joinItem({ ...HEAD, status: 'done', done_on: '2026-11-09', reader_effort: EFFORT }, REST) });
  const lib = `${r.dir}/scripts/gates/lib.mjs`;
  const text = readFileSync(lib, 'utf8');
  const broken = text.replace(/const \{ status, done_on, reader_effort, \.\.\.rest \}/, 'const { status, done_on, ...rest }');
  assert.notEqual(broken, text, 'contract() destructures reader_effort out of the head');
  writeFileSync(lib, broken); // the working tree only: the gate reads the PR's diff from git
  const out = r.gate('freeze', { labels: ['replan'], branch: `replan/${ID}-done` }, base);
  t.diagnostic(`exit ${out.status}: ${out.out.trim().split('\n').join(' / ')}`);
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, new RegExp(ID));
});

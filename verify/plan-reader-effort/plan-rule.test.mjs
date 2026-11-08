// Expect plan-rule: on a temp copy of the head's plan/, check.mjs refuses (exit 1, naming the item) a done build item
// whose reader_effort has an unknown field or a non-integer value; it passes the same item with a well-formed
// reader_effort, with no verdict file, with an earlier done_on, and a done probe item with neither. Reader effort is
// read from git now, so a verified done build item without the field passes too.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { REPO, joinItem, node, splitItem } from './lib.mjs';

const BUILD = 'clean-room-install-test'; // a done build item on the real plan, with no done_on
const PROBE = 'probe-platform-baseline'; // a done probe item
// The numbers the command printed for PR 189 (evidence/real-prs.md), as a done replan would paste them.
const WELL_FORMED = { pr: 189, files: 28, exports_added: 2, exports_removed: 0, reader_lines: 1494,
  added: { code: 120, tests: 160, verifier: 455, evidence: 163, docs: 59 },
  removed: { code: 18, tests: 11, verifier: 0, evidence: 0, docs: 21 } };

const liveModules = () => readdirSync(join(REPO, 'plan/items'))
  .filter((f) => f.endsWith('.md'))
  .map((f) => splitItem(readFileSync(join(REPO, 'plan/items', f), 'utf8')).head ?? {})
  .filter((it) => it.module && it.status === 'ready')
  .map((it) => it.module);

function check(t, id, edit, { verdict }) {
  const dir = mkdtempSync(join(tmpdir(), 'pre-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  // The copy holds plan/ alone, so each module a real ready item names is made in it too.
  for (const path of liveModules()) { mkdirSync(dirname(join(dir, path)), { recursive: true }); writeFileSync(join(dir, path), ''); }
  const p = join(dir, 'plan/items', `${id}.md`);
  const { head, rest } = splitItem(readFileSync(p, 'utf8'));
  writeFileSync(p, joinItem(edit({ ...head }), rest));
  if (verdict) {
    mkdirSync(join(dir, 'verify', id), { recursive: true });
    writeFileSync(join(dir, 'verify', id, 'verdict.json'), JSON.stringify({ item: id }) + '\n');
  }
  const r = node([join(dir, 'plan/check.mjs')], { cwd: dir });
  t.diagnostic(`exit ${r.status}: ${r.out.trim().split('\n').filter((l) => l.includes(id) || /plan ok/.test(l)).join(' / ')}`);
  return r;
}
const refused = (r, id) => {
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, new RegExp(`${id}`));
};
const passed = (r) => assert.equal(r.status, 0, r.out);
const done = (on, extra = {}) => (h) => ({ ...h, status: 'done', done_on: on, ...extra });

test('the untouched copy passes', (t) => passed(check(t, BUILD, (h) => h, { verdict: false })));

test('a reader_effort with an unknown field or a non-integer value is refused, naming the item', (t) => {
  const bad = [
    { ...WELL_FORMED, minutes: 3 },
    { ...WELL_FORMED, reader_lines: 1.5 },
    { ...WELL_FORMED, files: '28' },
    { ...WELL_FORMED, added: { ...WELL_FORMED.added, code: 2.5 } },
    { ...WELL_FORMED, removed: { ...WELL_FORMED.removed, styles: 1 } },
  ];
  for (const reader_effort of bad) refused(check(t, BUILD, done('2026-11-09', { reader_effort }), { verdict: true }), BUILD);
});

test('the same item passes with a well-formed reader_effort', (t) =>
  passed(check(t, BUILD, done('2026-11-09', { reader_effort: WELL_FORMED }), { verdict: true })));

test('the same item passes with no verdict file beside the copy (a test\'s made-up item)', (t) =>
  passed(check(t, BUILD, done('2026-11-09'), { verdict: false })));

test('a done build item with an earlier done_on passes without reader_effort', (t) =>
  passed(check(t, BUILD, done('2026-11-08'), { verdict: true })));

test('a done probe item passes with neither reader_effort nor a verdict file, and with a verdict and a late date', (t) => {
  passed(check(t, PROBE, done('2026-11-09'), { verdict: false }));
  passed(check(t, PROBE, done('2026-11-09'), { verdict: true }));
});

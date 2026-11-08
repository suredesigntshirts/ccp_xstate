// Expect done-on-held: the freeze gate holds a done_on set at the base. It refuses a moved or removed date, naming the
// item and both dates, unless the PR is labelled replan, changes only plan/, and its item gains or rewrites a
// ## Done on change section; setting done_on where there was none is free.
import test from 'node:test';
import assert from 'node:assert/strict';
import { itemText, tempRepo } from './lib.mjs';

const WAS = '2026-11-01', NOW = '2026-11-05';
const WHY = '\n## Done on change\n\nThe merge landed on 2026-11-05; 2026-11-01 was the replan date.\n';

/** base: item y done on WAS, item z ready with no date, a source file. pr(files, labels) runs freeze on a PR branch. */
function world(t, { yExtra = '' } = {}) {
  const r = tempRepo(t, {
    'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: WAS, extra: yExtra }),
    'plan/items/z.md': itemText({ id: 'z', status: 'ready' }),
    'src/a.js': 'export const a = 1;\n',
  });
  let n = 0;
  return {
    ...r,
    pr(files, labels) {
      r.git('checkout', '-q', '-b', `pr-${n++}`, r.base);
      r.commit(files, 'pr');
      return r.gate('freeze', { BASE_SHA: r.base, HEAD_SHA: '', PR_BODY: '', PR_LABELS: JSON.stringify(labels) });
    },
  };
}

const refusedNaming = (r, now) => {
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, new RegExp(`done_on of y from ${WAS} to ${now.replace(/[()]/g, '\\$&')}`));
};

test('date changed with no replan label: exit 1, names y and both dates', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW }) }, []);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
});

test('replan label with a file outside plan/, even with a Done on change section: exit 1', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW, extra: WHY }),
    'src/a.js': 'export const a = 2;\n' }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
  assert.match(r.out, /src\/a\.js/);
});

test('plan-only replan with no Done on change section: exit 1', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW }) }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
});

test('plan-only replan that removes done_on without the section: exit 1', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done' }) }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, '(none)');
});

test('plan-only replan whose base already has the section and that does not rewrite it: exit 1', (t) => {
  const r = world(t, { yExtra: WHY }).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW, extra: WHY }) }, ['replan']);
  t.diagnostic(r.out.trim());
  refusedNaming(r, NOW);
});

test('plan-only replan whose item gains a Done on change section: exit 0', (t) => {
  const r = world(t).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW, extra: WHY }) }, ['replan']);
  assert.equal(r.status, 0, r.out);
});

test('plan-only replan that rewrites an existing Done on change section: exit 0', (t) => {
  const r = world(t, { yExtra: WHY }).pr({ 'plan/items/y.md': itemText({ id: 'y', status: 'done', done_on: NOW,
    extra: `${WHY}A second move: the release date is the one the fix budget counts.\n` }) }, ['replan']);
  assert.equal(r.status, 0, r.out);
});

test('any PR that sets done_on on an item that had none: exit 0', (t) => {
  const w = world(t);
  const plain = w.pr({ 'plan/items/z.md': itemText({ id: 'z', status: 'done', done_on: NOW }) }, []);
  assert.equal(plain.status, 0, plain.out);
  const replan = w.pr({ 'plan/items/z.md': itemText({ id: 'z', status: 'done', done_on: NOW }) }, ['replan']);
  assert.equal(replan.status, 0, replan.out);
});

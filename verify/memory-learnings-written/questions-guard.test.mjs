// questions-guard: the guard reads the questions file against each home; it is green on the tree and goes red, naming
// the question, when one carrying term leaves a copy of its home.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { childEnv } from '../../test/regression/lib.mjs';
import { REPO } from './lib.mjs';

const GUARD = 'test/notes-questions.test.mjs';
const DATA = 'test/notes-questions.json';
const { questions } = JSON.parse(readFileSync(join(REPO, DATA), 'utf8'));
const run = (root) => spawnSync('node', ['--test', '--test-reporter=tap', GUARD], { cwd: root, env: childEnv(), encoding: 'utf8' });

function copy() {
  const root = mkdtempSync(join(tmpdir(), 'mlw-guard-'));
  for (const p of [GUARD, DATA, ...new Set(questions.map((q) => q.home))]) {
    mkdirSync(dirname(join(root, p)), { recursive: true });
    cpSync(join(REPO, p), join(root, p));
  }
  return root;
}

test('the data names a home and terms for every question, across all three homes', () => {
  assert.ok(questions.length >= 12);
  assert.deepEqual([...new Set(questions.map((q) => q.home))].sort(), ['docs/traps.md', 'docs/verifying.md', 'plan/ledger/platform.md']);
});

test('green over a copy of the tree', () => {
  const r = run(copy());
  assert.equal(r.status, 0, r.stdout);
  assert.match(r.stdout, new RegExp(`# pass ${questions.length + 1}\\b`));
});

for (const [i, q] of [[0, questions[0]], [5, questions[5]], [11, questions[11]]]) {
  test(`red naming question ${i + 1} when "${q.terms[0]}" leaves ${q.home}`, () => {
    const root = copy();
    const text = readFileSync(join(root, q.home), 'utf8');
    const esc = q.terms[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+');
    const cut = text.replace(new RegExp(esc, 'gi'), 'XXXX');
    assert.notEqual(cut, text);
    writeFileSync(join(root, q.home), cut);
    const r = run(root);
    assert.equal(r.status, 1);
    const failed = r.stdout.split('\n').filter((l) => l.startsWith('not ok'));
    assert.equal(failed.length, 1, failed.join('\n'));
    assert.ok(failed[0].includes(q.q.slice(0, 40)), failed[0]);
    assert.match(r.stdout, new RegExp(`no longer answers`));
  });
}

// Expect fresh-reader-path, the part a test can redo: a fresh session's answers (evidence/fresh-reader-path.md) for
// draft item test-fixture-edges, carried out in a temp repo copied from the checkout, pass the freeze and verdict
// gates as answered. (1) readying replan: replan/test-fixture-edges-ready, label replan, no Item line, plan/ only.
// (2) build PR: build/test-fixture-edges, body "Item: test-fixture-edges", a Claude-Session trailer, one line
// outside plan/; refused for its missing verdict, not its naming. (4) done replan: replan/test-fixture-edges-done,
// label replan, plan/ only, a ## Done section.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gateRepo } from './lib.mjs';

const ID = 'test-fixture-edges';
const ITEM = `plan/items/${ID}.md`;

function carry(t, branch, files, body, labels) {
  const r = gateRepo(t);
  r.branch(branch);
  const write = typeof files === 'function' ? files(r) : files;
  r.commit(write, `${branch.split('/')[0]}: ${ID}\n\nClaude-Session: https://claude.ai/code/session_rso-builder`);
  const freeze = r.gate('freeze', { branch, body, labels });
  const verdict = r.gate('verdict', { branch, body, labels });
  t.diagnostic(`${branch} freeze: ${freeze.out.trim()}`);
  t.diagnostic(`${branch} verdict: ${verdict.out.trim()}`);
  return { freeze, verdict };
}

test('(1) the readying replan, as answered, passes freeze and verdict', (t) => {
  const { freeze, verdict } = carry(t, `replan/${ID}-ready`,
    (r) => ({ [ITEM]: r.file(ITEM).replace('## ', 'A sentence of prose the readying replan adds.\n\n## ') }),
    'Makes test-fixture-edges ready.', ['replan']);
  assert.equal(freeze.status, 0, freeze.out);
  assert.equal(verdict.status, 0, verdict.out);
});

test('(2) the build PR, as answered, is refused only for its missing verdict', (t) => {
  const { freeze, verdict } = carry(t, `build/${ID}`, { 'test/rso-line.txt': 'one line\n' },
    `Builds it.\n\nItem: ${ID}\n`, []);
  assert.equal(freeze.status, 0, freeze.out);
  assert.equal(verdict.status, 1, verdict.out);
  assert.match(verdict.out, new RegExp(`verdict gate failed \\(item ${ID}\\):\\n  no verify/${ID}/verdict\\.json at the head sha\\s*$`));
  assert.doesNotMatch(verdict.out, /names no item|doesn't have/);
});

test('(4) the done replan, as answered, passes freeze and verdict', (t) => {
  const { freeze, verdict } = carry(t, `replan/${ID}-done`,
    (r) => ({ [ITEM]: `${r.file(ITEM)}\n## Done\n\nBuilt in a build PR and verified by a separate session.\n` }),
    'Marks test-fixture-edges done.', ['replan']);
  assert.equal(freeze.status, 0, freeze.out);
  assert.equal(verdict.status, 0, verdict.out);
});

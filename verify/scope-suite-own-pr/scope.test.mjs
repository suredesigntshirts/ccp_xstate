// Expect scope: the PR changes only the suite file and its own item file; rules-said-once's verdict.json and every
// other file under verify/ are as they were at the base. The build is stacked on its readying replan, so its own
// changes are READY..HEAD; against the PR's base on GitHub only the replan's plan/ files are added to that list.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { HEAD, MAIN_BASE, READY, REPO, SUITE, commits, git } from './lib.mjs';

const ok = commits();
const G = ok ? resolve(REPO, ok) : REPO;
const names = (a, b, ...p) => git(G, 'diff', '--name-only', '--no-renames', a, b, '--', ...p).split('\n').filter(Boolean).sort();

test('the build changes only the suite file and its item file', { skip: !ok && 'pinned commits unreachable' }, (t) => {
  const changed = names(READY, HEAD);
  t.diagnostic(`${READY.slice(0, 8)}..${HEAD.slice(0, 8)}: ${changed.join(', ')}`);
  assert.deepEqual(changed, ['plan/items/scope-suite-own-pr.md', SUITE].sort());
});

test("against the PR's base on GitHub, the rest is plan/ only and verify/ changes only the suite", { skip: !ok && 'pinned commits unreachable' }, (t) => {
  const changed = names(MAIN_BASE, HEAD);
  t.diagnostic(`${MAIN_BASE.slice(0, 8)}..${HEAD.slice(0, 8)}: ${changed.join(', ')}`);
  assert.deepEqual(changed.filter((p) => p !== SUITE && !p.startsWith('plan/')), []);
  assert.deepEqual(names(MAIN_BASE, HEAD, 'verify'), [SUITE]);
  assert.equal(git(G, 'rev-parse', `${HEAD}:verify/rules-said-once/verdict.json`),
    git(G, 'rev-parse', `${MAIN_BASE}:verify/rules-said-once/verdict.json`));
});

test('the pinned commits are reachable', () => assert.ok(ok, 'could not read the pinned commits and their history'));

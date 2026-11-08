// Expect scope: the PR changes only the suite file, docs/traps.md and its own item file; plan-reader-effort's
// verdict.json and evidence are as they were at the base. The readying replan has merged and main is merged into the
// build, so the PR's own changes are its GitHub base (main) to its head.
import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { HEAD, MAIN, REPO, SUITE, TRAPS, commits, git } from './lib.mjs';

const ok = commits();
const G = ok ? resolve(REPO, ok) : REPO;
const skip = !ok && 'pinned commits unreachable';
const names = (a, b, ...p) => git(G, 'diff', '--name-only', '--no-renames', a, b, '--', ...p).split('\n').filter(Boolean).sort();
const WANT = ['plan/items/effort-scope-own-pr.md', TRAPS, SUITE].sort();

test("against the PR's base on GitHub only the two outputs and its item file change", { skip }, (t) => {
  const changed = names(MAIN, HEAD);
  t.diagnostic(`${MAIN.slice(0, 8)}..${HEAD.slice(0, 8)}: ${changed.join(', ')}`);
  assert.deepEqual(changed, WANT);
});

test("plan-reader-effort's verdict.json and evidence are unchanged", { skip }, (t) => {
  const touched = names(MAIN, HEAD, 'verify/plan-reader-effort/verdict.json', 'verify/plan-reader-effort/evidence');
  t.diagnostic(`verdict and evidence changes: ${touched.length}`);
  assert.deepEqual(touched, []);
  assert.equal(git(G, 'rev-parse', `${HEAD}:verify/plan-reader-effort/verdict.json`),
    git(G, 'rev-parse', `${MAIN}:verify/plan-reader-effort/verdict.json`));
});

test('the pinned commits are reachable', () => assert.ok(ok, 'could not read the pinned commits and their history'));

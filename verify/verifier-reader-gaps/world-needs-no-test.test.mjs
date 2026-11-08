// Expect world-needs-no-test: the verdict gate passes a complete verdict whose world result has no test field, and
// docs/gates.md, The verdict, says a world result needs no test and a line about the PR's checks cites them at
// verified_sha.
import test from 'node:test';
import assert from 'node:assert/strict';
import { node, read, section } from './lib.mjs';
import { TOY, WORLD_RESULT, buildWithVerdict } from './gate-fixture.mjs';

const gate = (r) => node(['scripts/gates/pr-gate.mjs', 'verdict'], { cwd: r.dir,
  env: { BASE_SHA: 'origin/main', PR_BODY: `Item: ${TOY}` } });

test('the gate passes a verdict whose world result names no test', (t) => {
  const r = buildWithVerdict(t);
  const v = JSON.parse(r.file(`verify/${TOY}/verdict.json`));
  assert.equal('test' in v.results.find((x) => x.id === 'shown'), false);
  const out = gate(r);
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 0, out.out);
});

test('the same fixture is refused when the world result is not complete, so the pass above is the gate judging it', (t) => {
  const r = buildWithVerdict(t, { world: { ...WORLD_RESULT, excerpt: '' } });
  const out = gate(r);
  t.diagnostic(out.out.trim());
  assert.equal(out.status, 1, out.out);
  assert.match(out.out, /shown/);
});

test('docs/gates.md, The verdict, says a world result needs no test and a checks line cites verified_sha', () => {
  const text = section(read('docs/gates.md'), 'The verdict').replace(/\s+/g, ' ');
  assert.match(text, /a `world` result needs no `test`/);
  assert.match(text, /one about the PR's checks cites them at `verified_sha`/);
  assert.match(text, /each `verifier` or `builder` result names a file under `verify\/<item>\/` in `test`/);
  assert.match(text, /"model": "<its own model id>"/);
});

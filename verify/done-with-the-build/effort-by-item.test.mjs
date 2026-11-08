// Expect effort-by-item: in a temp repo with three merged PRs, the second adding verify/<id>/verdict.json and the
// third changing the item file again (and the verdict), `reader-effort.mjs --item <id> --json` prints what
// `reader-effort.mjs <second PR> --json` prints; for an item no merge added a verdict for, it exits non-zero naming it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { node, tempRepo } from './lib.mjs';

const body = (n) => Array.from({ length: n }, (_, i) => `export const v${i} = ${i};`).join('\n') + '\n';

function threePrs(t) {
  const r = tempRepo(t, { copy: ['scripts/reader-effort.mjs'] });
  r.commit({ 'plan/items/probe.md': '{"status":"ready"}\n', 'src/one.js': body(2) }, 'main work');
  const pr = (n, branch, files) => {
    r.git('checkout', '-q', '-b', branch, 'main');
    r.commit(files, `work on ${branch}`);
    r.git('checkout', '-q', 'main');
    r.git('merge', '-q', '--no-ff', '-m', `Merge pull request #${n} from o/${branch}`, branch);
  };
  pr(11, 'first', { 'src/one.js': body(5), 'docs/a.md': 'a\n' });
  pr(12, 'build', { 'plan/items/probe.md': '{"status":"done"}\n', 'src/two.js': body(7),
    'verify/probe/verdict.json': '{"item":"probe"}\n', 'verify/probe/a.test.mjs': 'x\n' });
  pr(13, 'later', { 'plan/items/probe.md': '{"status":"done"}\n\n## Done\n', 'src/one.js': body(9),
    'verify/probe/verdict.json': '{"item":"probe","again":1}\n' });
  return r;
}

const effort = (r, ...args) => node([join(r.dir, 'scripts/reader-effort.mjs'), ...args, '--json'], { cwd: r.dir });

test('--item reads the build PR that added the verdict, not a later merge touching the item', (t) => {
  const r = threePrs(t);
  const byItem = effort(r, '--item', 'probe');
  const byPr = effort(r, '12');
  const later = effort(r, '13');
  assert.equal(byItem.status, 0, byItem.out);
  assert.equal(byPr.status, 0, byPr.out);
  const a = JSON.parse(byItem.stdout), b = JSON.parse(byPr.stdout), c = JSON.parse(later.stdout);
  assert.deepEqual(a, b);
  assert.equal(a.pr, 12);
  assert.notDeepEqual({ ...a, pr: 13 }, c, 'PR #13 reads differently, so the match is not by accident');
  t.diagnostic(`--item probe: ${JSON.stringify(a)}`);
  t.diagnostic(`#12: ${JSON.stringify(b)}`);
  t.diagnostic(`#13: ${JSON.stringify(c)}`);
});

test('--item for an item with no merged verdict exits non-zero naming it', (t) => {
  const r = threePrs(t);
  const out = effort(r, '--item', 'never-verified');
  assert.notEqual(out.status, 0);
  assert.match(out.out, /never-verified/);
  t.diagnostic(`exit ${out.status}: ${out.out.trim().split('\n')[0]}`);
});

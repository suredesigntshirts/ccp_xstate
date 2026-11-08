// Expect tests-bite: the builder's new pr-gate test goes red when contract() keeps status, and its --item test goes
// red when --item takes the last merge touching the verdict file rather than the first that adds it; each is green
// again when restored. Every mutation happens in a temp copy of scripts/, never in this checkout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node } from './lib.mjs';

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });
const failing = (out) => [...out.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);

function bite(t, { file, testFile, from, to }) {
  const dir = mkdtempSync(join(tmpdir(), 'dwtb-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'scripts'), join(dir, 'scripts'), { recursive: true });
  const run = () => node(['--test', '--test-reporter=tap', join(dir, testFile)], { cwd: dir });
  const path = join(dir, file);
  const text = readFileSync(path, 'utf8');
  const pairs = [].concat(from).map((f, i) => [f, [].concat(to)[i]]);
  for (const [f] of pairs) assert.ok(text.includes(f), `${file} holds the line the mutation changes: ${f}`);
  const green = run();
  assert.equal(green.status, 0, green.out);
  writeFileSync(path, pairs.reduce((s, [f, x]) => s.replace(f, x), text));
  const red = run();
  writeFileSync(path, text);
  const again = run();
  assert.notEqual(red.status, 0, red.out);
  assert.equal(again.status, 0, again.out);
  t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}; red: ${failing(red.out).join(' | ')}`);
  return failing(red.out);
}

test('pr-gate.test.mjs goes red when contract() keeps status', (t) => {
  const red = bite(t, { file: 'scripts/gates/lib.mjs', testFile: 'scripts/gates/test/pr-gate.test.mjs',
    from: 'const { status, done_on, reader_effort, ...rest } = itemHead(text) ?? {};',
    to: 'const { done_on, reader_effort, ...rest } = itemHead(text) ?? {};' });
  assert.ok(red.includes('a build PR whose first commit sets its item done passes freeze, and merges on a verdict from another session'), red.join(' | '));
});

test('reader-effort.test.mjs goes red when --item takes the last merge touching the verdict', (t) => {
  const red = bite(t, { file: 'scripts/reader-effort.mjs', testFile: 'scripts/reader-effort.test.mjs',
    from: ["['log', '--merges', '--first-parent', '--reverse', '--format=%H %s', 'HEAD', '--', verdict]",
      'if (!has(cwd, sha, verdict) || has(cwd, `${sha}^1`, verdict)) continue;'],
    to: ["['log', '--merges', '--first-parent', '--format=%H %s', 'HEAD', '--', verdict]",
      'if (!has(cwd, sha, verdict)) continue;'] });
  assert.ok(red.some((n) => n.startsWith('--item reads the merge that added')), red.join(' | '));
});

// moved-bite: for one moved test in each of plan/ and gates/, and one in engine/, which this PR adds to, a scratch copy
// of the head with the behaviour the test asserts broken makes that test file red; restored, it is green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

/** Each case: the moved test, the source file it drives, and one edit that breaks what it asserts. */
const CASES = [
  {
    area: 'plan', test: 'test/regression/plan/no-doing-status.test.mjs', file: 'plan/item.schema.json',
    what: 'the item schema allows status doing again, so the plan check takes an item at doing',
    from: '        "ready",\n        "done",\n', to: '        "ready",\n        "doing",\n        "done",\n'
  },
  {
    area: 'gates', test: 'test/regression/gates/verdict-cutoff.test.mjs', file: 'scripts/gates/lib.mjs',
    what: 'the verdict gate\'s cutoff sees no contract move after verified_sha',
    from: "  const moved = contractMoves(before, after ?? '');\n  return moved.length ?", to: '  const moved = [];\n  return moved.length ?'
  },
  {
    area: 'engine', test: 'test/regression/engine/event-close-tag.test.mjs', file: 'packages/engine/src/wake.js',
    what: 'a wake\'s event closes at any </event>, even one inside a GitHub field',
    from: '(?:\\n[ \\t]*<\\/event>|', to: '(?:<\\/event>|'
  }
];

function copyHead() {
  const dir = mkdtempSync(join(tmpdir(), `vrs-bite-${process.pid}-`));
  for (const n of readdirSync(REPO)) if (n !== '.git' && n !== 'verify') cpSync(join(REPO, n), join(dir, n), { recursive: true, verbatimSymlinks: true });
  return dir;
}

function run(dir, file) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: dir, env, encoding: 'utf8', maxBuffer: 1e8, timeout: 600_000 });
  return { exit: r.status, pass: Number(r.stdout.match(/^# pass (\d+)/m)?.[1] ?? 0), fail: Number(r.stdout.match(/^# fail (\d+)/m)?.[1] ?? 0), red: r.stdout.split('\n').filter((l) => /^\s*not ok/.test(l)).map((l) => l.trim()) };
}

let dir;
test.before(() => { dir = copyHead(); });
test.after(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

for (const c of CASES) {
  test(`moved-bite ${c.area}: ${c.test} goes red when ${c.what}, and green restored`, { timeout: 900_000 }, (t) => {
    const path = join(dir, c.file);
    const good = readFileSync(path, 'utf8');
    assert.equal(good.split(c.from).length, 2, `${c.file} holds the text the edit replaces, once`);
    writeFileSync(path, good.replace(c.from, c.to));
    const broken = run(dir, c.test);
    writeFileSync(path, good);
    const restored = run(dir, c.test);
    assert.notEqual(broken.exit, 0, 'broken: exits non-zero');
    assert.ok(broken.fail >= 1, `broken: ${broken.fail} fail`);
    assert.equal(restored.exit, 0, 'restored: exits 0');
    assert.equal(restored.fail, 0);
    assert.ok(restored.pass >= 1);
    t.diagnostic(`broken: ${broken.fail} red (${broken.red.slice(0, 2).join(' | ')}); restored: ${restored.pass} pass`);
  });
}

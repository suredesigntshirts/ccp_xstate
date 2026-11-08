// moved-bite: for one moved test in each of plugin/, inspector/ and journal/, a scratch copy of the head with the behaviour
// it asserts broken makes that test file red; restored, it is green.
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
    area: 'plugin', test: 'test/regression/plugin/return-tool-answer.test.mjs', file: 'plugins/harness/scripts/return-tool.mjs',
    what: 'the return-tool server answers accepted to any result once one is stored, not only the one the hook stored',
    from: '  if (same) {\n', to: '  if (stored) {\n'
  },
  {
    area: 'inspector', test: 'test/regression/inspector/item-views.test.mjs', file: 'plugins/harness/pages/observe/data.js',
    what: 'the page\'s reader keeps every agent.finish row, not only each agent\'s last',
    from: '  const kept = new Set(last.values());\n', to: '  const kept = new Set(rows);\n'
  },
  {
    area: 'journal', test: 'test/regression/journal/journal-check.test.mjs', file: 'packages/journal/src/check.js',
    what: 'the journal check counts every transcript tool call as journalled, so none is missing',
    from: '    if (journalled.has(call.id)) continue;\n', to: '    if (true) continue;\n'
  }
];

function copyHead() {
  const dir = mkdtempSync(join(tmpdir(), 'vrp-bite-'));
  for (const n of readdirSync(REPO)) if (n !== '.git' && n !== 'verify') cpSync(join(REPO, n), join(dir, n), { recursive: true, verbatimSymlinks: true });
  return dir;
}

function run(dir, file) {
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: dir, env, encoding: 'utf8', maxBuffer: 1e8, timeout: 600_000 });
  return { exit: r.status, pass: Number(r.stdout.match(/^# pass (\d+)/m)?.[1] ?? 0), fail: Number(r.stdout.match(/^# fail (\d+)/m)?.[1] ?? 0), red: r.stdout.split('\n').filter((l) => l.startsWith('not ok')) };
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

// Expect: verify-regression-engine/moved-bite
// For one moved test in each of engine/, run/ and marks/, a scratch copy of the head with the behaviour
// it asserts broken makes that test file red; restored, it is green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');

/** Each case: the moved test, the source file it drives, and one edit that breaks what it asserts. */
const CASES = [
  {
    area: 'engine', test: 'test/regression/engine/quick-fix-cases.test.mjs', file: 'workflows/quick-fix.json',
    what: 'verifiedHead no longer asks that the verdict\'s head is the PR\'s head',
    from: '{ "path": "context.verdict.pr.at", "same": "context.pr.at" }, ', to: ''
  },
  {
    area: 'run', test: 'test/regression/run/lifecycle-store.test.mjs', file: 'packages/engine/src/run/store.js',
    what: 'store transition() no longer refuses a transition from a state it does not leave from',
    from: '  if (!t.from.includes(state(root, run))) return false;\n', to: '\n'
  },
  {
    area: 'marks', test: 'test/regression/marks/declared-marks.test.mjs', file: 'packages/engine/src/stages.js',
    what: 'the load check no longer refuses a marked verdict value its field does not hold',
    from: 'if (!words(node).includes(value)) bad(', to: 'if (false) bad('
  }
];

const LINKED = ['bench', 'tournaments', 'node_modules'];

function copyHead() {
  const dir = mkdtempSync(join(tmpdir(), 'vre-bite-'));
  // The recorded bench runs, the tournaments and node_modules are most of the tree and no case edits them: linked, not copied.
  for (const n of readdirSync(REPO)) {
    if (n === '.git' || n === 'verify') continue;
    if (LINKED.includes(n)) symlinkSync(join(REPO, n), join(dir, n));
    else cpSync(join(REPO, n), join(dir, n), { recursive: true, verbatimSymlinks: true });
  }
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

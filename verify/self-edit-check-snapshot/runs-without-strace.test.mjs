// runs-without-strace: no test file under test/, verify/, packages/ or plugins/ spawns strace, and with strace off
// PATH the no-self-edit file runs its six tests, none skipped, all passing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { NO_SELF_EDIT, REPO, nodeTest, onPath, pathWithout, temp } from './lib.mjs';

const TOOL = 'str' + 'ace';

function testFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...testFiles(p));
    else if (/\.(m|c)?js$/.test(e.name)) out.push(p);
  }
  return out;
}

test('runs-without-strace: no test-tree file names the tool as a command', () => {
  // The tool's name as a whole quoted string (a spawn's command or argument) or a shell line that starts it.
  const spawnish = new RegExp(`(['"\`])${TOOL}\\1|\\b${TOOL}\\s+-`);
  const files = ['test', 'verify', 'packages', 'plugins'].flatMap((d) => testFiles(join(REPO, d)));
  const hits = files.filter((f) => spawnish.test(readFileSync(f, 'utf8'))).map((f) => relative(REPO, f));
  assert.ok(files.length > 100, `${files.length} files read`);
  assert.deepEqual(hits, []);
  assert.doesNotMatch(readFileSync(join(REPO, NO_SELF_EDIT), 'utf8'), new RegExp(TOOL), 'the no-self-edit file does not mention it at all');
});

test('runs-without-strace: with no strace on PATH all six no-self-edit tests run and pass', (t) => {
  const bin = pathWithout(temp(t, 'bin'), [TOOL]);
  assert.equal(onPath(TOOL, bin), false, 'the tool is not on the PATH the run gets');
  assert.equal(onPath('node', bin) && onPath('git', bin) && onPath('bash', bin), true);
  const r = nodeTest(REPO, NO_SELF_EDIT, { env: { ...process.env, PATH: bin } });
  t.diagnostic(`tests ${r.tests} pass ${r.pass} fail ${r.fail} skipped ${r.skipped}`);
  assert.deepEqual({ tests: r.tests, pass: r.pass, fail: r.fail, skipped: r.skipped }, { tests: 6, pass: 6, fail: 0, skipped: 0 }, r.out.slice(-3000));
});

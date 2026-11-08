// The reader-effort report, run on temp git repos built for each case.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { category, exportsOf, definitionsOf } from './reader-effort.mjs';

const SCRIPT = join(import.meta.dirname, 'reader-effort.mjs');
const ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

function repo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'reader-effort-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, env: ENV, encoding: 'utf8' });
  git('init', '-q', '-b', 'main');
  const write = (files) => {
    for (const [p, text] of Object.entries(files)) {
      mkdirSync(join(dir, dirname(p)), { recursive: true });
      writeFileSync(join(dir, p), text);
    }
  };
  const commit = (files, msg = 'c') => { write(files); git('add', '-A'); git('commit', '-q', '-m', msg); };
  const run = (...args) => JSON.parse(execFileSync(process.execPath, [SCRIPT, ...args, '--json'], { cwd: dir, encoding: 'utf8' }));
  return { dir, git, commit, run };
}

const lines = (n, prefix = 'x') => Array.from({ length: n }, (_, i) => `${prefix}${i}`).join('\n') + '\n';

test('each path falls in the category its first matching rule gives', () => {
  assert.equal(category('verify/x/verdict.json'), 'evidence');
  assert.equal(category('verify/x/evidence/a.md'), 'evidence');
  assert.equal(category('verify/x/a.test.mjs'), 'verifier');
  assert.equal(category('verify/x/helper.mjs'), 'verifier');
  assert.equal(category('scripts/a.test.mjs'), 'tests');
  assert.equal(category('packages/engine/test/fixtures/a.json'), 'tests');
  assert.equal(category('docs/gates.md'), 'docs');
  assert.equal(category('plan/items/x.md'), 'docs');
  assert.equal(category('workflows/quick-fix/build.md'), 'code');
  assert.equal(category('packages/engine/messages.md'), 'code');
  assert.equal(category('packages/engine/src/host.js'), 'code');
  assert.equal(category('plan/item.schema.json'), 'code');
});

test('a merged PR is read as its merge against the first parent, by number or by range', (t) => {
  const r = repo(t);
  r.commit({ 'src/a.js': lines(3), 'README.md': 'hi\n' });
  r.git('checkout', '-q', '-b', 'feature');
  r.commit({
    'src/a.js': lines(5), 'src/a.test.mjs': lines(2), 'verify/it/b.test.mjs': lines(4), 'verify/it/verdict.json': lines(6),
    'docs/x.md': lines(1), 'workflows/wf/build.md': lines(2),
  });
  r.git('checkout', '-q', 'main');
  r.commit({ 'README.md': 'hi\nthere\n' }, 'main moves');
  r.git('merge', '-q', '--no-ff', '-m', 'Merge pull request #7 from o/feature', 'feature');
  const byNumber = r.run('7');
  assert.equal(byNumber.pr, 7);
  assert.equal(byNumber.files, 6);
  assert.deepEqual(byNumber.added, { code: 4, tests: 2, verifier: 4, evidence: 6, docs: 1 });
  assert.deepEqual(byNumber.removed, { code: 0, tests: 0, verifier: 0, evidence: 0, docs: 0 });
  const byRange = r.run('main~1..feature');
  assert.equal(byRange.pr, undefined);
  assert.deepEqual(byRange.added, byNumber.added);
});

test('exports added and removed are counted in code files only', (t) => {
  const r = repo(t);
  r.commit({ 'src/a.js': 'export function old() {}\nexport const keep = 1;\n', 'src/a.test.mjs': '' });
  r.git('checkout', '-q', '-b', 'f');
  r.commit({
    'src/a.js': 'export const keep = 1;\nexport function f() {}\nexport const g = 2;\nconst a = 1;\nexport { a as b };\n',
    'src/b.mjs': 'export default 1;\n',
    'src/a.test.mjs': 'export function helper() {}\n',
  });
  const out = r.run('main..f');
  assert.equal(out.exports_added, 4);
  assert.equal(out.exports_removed, 1);
});

test('reader lines are the hunks plus each called definition once, never evidence', (t) => {
  const r = repo(t);
  const helper = 'export function helper(x) {\n  const y = x + 1;\n  return y;\n}\n';
  r.commit({ 'src/lib.js': helper, 'src/use.js': '// use\n' });
  r.git('checkout', '-q', '-b', 'f');
  r.commit({
    'src/use.js': "// use\nimport { helper } from './lib.js';\nhelper(1);\nhelper(2);\nMath.max(1);\nunknown(3);\n",
    'src/fresh.js': 'export function fresh() {\n  return 1;\n}\nfresh();\n',
    'verify/it/evidence.json': lines(50),
  });
  const out = r.run('main..f');
  // Hunks: use.js 5 added, fresh.js 4 added; the helper's 4 lines once; fresh() is new, so already in the hunks.
  assert.equal(out.reader_lines, 5 + 4 + 4);
  assert.equal(out.added.evidence, 50);
});

test('definitions end at the first closing brace in column 0, or on their own line', () => {
  const defs = definitionsOf('const one = (a) => a;\nexport async function two() {\n  if (x) {\n  }\n}\nconst three = {\n  a: 1,\n};\n');
  assert.deepEqual(defs.map((d) => [d.name, d.start, d.lines]), [['one', 1, 1], ['two', 2, 4], ['three', 6, 3]]);
  assert.deepEqual([...exportsOf('export { a, b as c };\nexport class K {}\n')], ['a', 'c', 'K']);
});

test('an unknown PR number is an error naming it', (t) => {
  const r = repo(t);
  r.commit({ 'a.js': '' });
  assert.throws(() => execFileSync(process.execPath, [SCRIPT, '9'], { cwd: r.dir, stdio: 'pipe' }), /no merge commit for PR #9/);
});

// scope: the files the PR changes between its base and the verified head, and what the four plan-copy helpers add.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BASE, HEAD, ensure, git } from './lib.mjs';

const OWN = ['scripts/debug/trace-writes.mjs', 'scripts/debug/trace-writes.test.mjs', 'plan/items/fix-trace-writes-clone-cwd.md'];
const HELPERS = ['test/plan-check.test.mjs', 'verify/verification-contract/lib.mjs',
  'verify/verification-contract/tests-bite.test.mjs', 'verify/fix-budget-rule/lib.mjs'];

test('the PR changes only the item files and the four plan-copy helpers', (t) => {
  assert.ok(ensure(BASE) && ensure(HEAD), 'base and head commits readable');
  const files = git('diff', '--name-only', BASE, HEAD).split('\n').filter(Boolean);
  t.diagnostic(files.join(', '));
  assert.deepEqual(files.filter((f) => !OWN.includes(f) && !HELPERS.includes(f)), []);
  assert.ok(files.includes('scripts/debug/trace-writes.mjs'));
});

test('the four helpers only make module files in their temp copies', (t) => {
  assert.ok(ensure(BASE) && ensure(HEAD), 'base and head commits readable');
  for (const f of HELPERS) {
    const diff = git('diff', '-U0', BASE, HEAD, '--', f).split('\n');
    const removed = diff.filter((l) => l.startsWith('-') && !l.startsWith('---')).map((l) => l.slice(1));
    const added = diff.filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1));
    t.diagnostic(`${f}: -${removed.length} +${added.length}`);
    // Only import lines are replaced (to bring in readdirSync or makeLiveModules); no assertion or test is touched.
    for (const l of removed) assert.match(l, /^import \{[^}]*\} from '[^']+';$/, `${f} removes only imports: ${l}`);
    for (const l of added) assert.doesNotMatch(l, /\bassert\b|\btest\(|\bt\.skip\b|\.skip\(/, `${f} adds no assertion: ${l}`);
    // What is added is the live-module walk over plan/items and the empty files it writes.
    const text = added.join('\n');
    assert.match(text, /readdirSync\(join\(REPO, 'plan\/items'\)\)|makeLiveModules\(dir\)/, f);
    if (/writeFileSync/.test(text)) assert.match(text, /writeFileSync\(join\(dir, path\), ''\)/, f);
    assert.doesNotMatch(added.filter((l) => !l.startsWith('import ')).join('\n'), /rmSync|unlinkSync|renameSync/, f);
  }
});

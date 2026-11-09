// docs-say-so: CLAUDE.md, docs/layout.md, docs/gates.md and ci.yml's npm test step no longer say npm test covers
// verify/, and docs/layout.md says where a proof that should keep holding goes (test/regression/, as a guard).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const read = (p) => readFileSync(join(REPO, p), 'utf8');
const section = (text, heading) => { const i = text.indexOf(heading); return text.slice(i, text.indexOf('\n## ', i + 1) >>> 0); };

test('docs-say-so: CLAUDE.md\'s npm test line names the four roots and not verify/', () => {
  const line = read('CLAUDE.md').split('\n').find((l) => l.startsWith('npm test '));
  assert.ok(line, 'an npm test line');
  for (const r of ['test/', 'scripts/', 'packages/', 'plugins/']) assert.ok(line.includes(r), r);
  assert.ok(!line.includes('verify/'), line);
});

test('docs-say-so: ci.yml\'s npm test step is not named for verify', () => {
  const name = read('.github/workflows/ci.yml').split('\n').find((l) => /name:.*npm test/.test(l));
  assert.ok(name, 'an npm test step');
  assert.doesNotMatch(name, /verify/);
});

test('docs-say-so: docs/gates.md\'s npm test row says verify/ is not run there, and that the verdict gate runs it', () => {
  const row = read('docs/gates.md').split('\n').find((l) => l.startsWith('| `ci` | `npm test`'));
  assert.ok(row, 'the npm test row');
  const [fails, after] = row.split('verify/');
  for (const r of ['test/', 'scripts/', 'packages/', 'plugins/']) assert.ok(fails.includes(r), r);
  assert.match(after ?? '', /not run here/);
  assert.match(after ?? '', /verdict gate/);
});

test('docs-say-so: docs/layout.md\'s Tests section says npm test never runs verify/ and a lasting proof becomes a guard under test/regression/', () => {
  const tests = section(read('docs/layout.md'), '## Tests');
  const para = tests.split('\n\n').find((p) => p.includes('npm test') && p.includes('verify/'));
  assert.ok(para, 'a paragraph on npm test and verify/');
  assert.match(para, /never runs `verify\/`/);
  assert.match(para, /verdict gate/);
  assert.match(para, /guard under `test\/regression\/`/);
  assert.doesNotMatch(tests, /`plugins\/` and `verify\/`/, 'the old list of five roots');
});

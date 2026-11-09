// rule-written: docs/layout.md's Tests section names the clone helper and CCP_SETUP_SKILLS.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { read } from './lib.mjs';

test('rule-written: the Tests section names leanClone, its module, setup.sh and CCP_SETUP_SKILLS', () => {
  const text = read('docs/layout.md');
  const start = text.indexOf('\n## Tests\n');
  assert.ok(start >= 0, 'a Tests section');
  const end = text.indexOf('\n## ', start + 1);
  const section = text.slice(start, end < 0 ? undefined : end);
  for (const term of ['leanClone', 'test/regression/lib.mjs', 'clone', 'setup.sh', 'CCP_SETUP_SKILLS', 'npm ci']) {
    assert.ok(section.includes(term), `the Tests section names ${term}`);
  }
});

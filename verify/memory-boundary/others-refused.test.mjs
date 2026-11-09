// others-refused: the verdict gate still refuses a PR that names no item and changes a notes file together with any
// file outside plan/ and the notes files, and names that file.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { verdictOver } from './lib.mjs';

const others = {
  'docs/gates.md': '# Gates, softened\n',
  'docs/layout.md': '# Layout, softened\n',
  'CLAUDE.md': '# repo, softened\n',
  'scripts/gates/lib.mjs': 'export const a = 2;\n',
  'scripts/gates/new.mjs': 'export {};\n',
  'packages/engine/src/x.js': 'export {};\n',
  'docs/language.md': '# words\n',
  'docs/traps.md.bak': 'copy\n',
  'docs/verifying.md/x.md': 'not the file\n',
  'docs/Traps.md': 'case\n',
  'plans/x.md': 'not plan/\n',
  'verify/x/verdict.json': '{}\n',
  '.github/workflows/ci.yml': 'on: push\n',
};

for (const [other, text] of Object.entries(others)) {
  test(`verdict gate refuses docs/traps.md with ${other} and no Item line`, (t) => {
    const r = verdictOver(t, { 'docs/traps.md': '# Container traps\n\nmore\n', [other]: text });
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /names no item/);
    assert.ok(r.out.includes(`changes ${other} outside plan/`), r.out);
  });
}

test('verdict gate refuses a deleted rule file beside a notes change', (t) => {
  const r = verdictOver(t, { 'docs/traps.md': 'more\n', 'docs/layout.md': null });
  assert.equal(r.status, 1, r.out);
  assert.ok(r.out.includes('changes docs/layout.md outside plan/'), r.out);
});

test('verdict gate refuses docs/verifying.md with a script and no Item line', (t) => {
  const r = verdictOver(t, { 'docs/verifying.md': 'b\n', 'plan/decisions/d.md': 'd\n', 'scripts/gates/lib.mjs': 'export const a = 3;\n' });
  assert.equal(r.status, 1, r.out);
  assert.ok(r.out.includes('changes scripts/gates/lib.mjs outside plan/'), r.out);
  assert.ok(!r.out.includes('plan/decisions/d.md outside'), r.out);
});

// docs-point: docs/verifying.md names the two tools, one line each, and neither notes file spells out the env -u recipe.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const read = (p) => readFileSync(join(REPO, p), 'utf8');

test('verifying.md names each tool on exactly one line', () => {
  const lines = read('docs/verifying.md').split('\n');
  for (const path of ['scripts/fresh-reader.mjs', 'scripts/gates/new-verdict.mjs']) {
    assert.equal(lines.filter((l) => l.includes(path)).length, 1, path);
  }
});

test('neither notes file spells out the recipe the fresh reader holds', () => {
  for (const file of ['docs/verifying.md', 'docs/traps.md']) {
    const text = read(file);
    assert.doesNotMatch(text, /env -u/, file);
    for (const key of ['CLAUDE_MEMORY_STORES', 'CLAUDE_COWORK_MEMORY_PATH_OVERRIDE', 'CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD',
      'CLAUDE_ADDITIONAL_DIRECTORIES', 'CLAUDE_CODE_DISABLE_AUTO_MEMORY']) assert.equal(text.includes(key), false, `${file} names ${key}`);
  }
});

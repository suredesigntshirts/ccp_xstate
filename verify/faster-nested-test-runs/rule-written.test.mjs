// Expect: faster-nested-test-runs/rule-written
// docs/layout.md's Tests section says how a test that runs other tests names them and checks they ran, and that a
// copy of the repo does not copy bench/, tournaments/ or node_modules. Matched by the terms that carry each rule.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const doc = readFileSync(join(REPO, 'docs/layout.md'), 'utf8');
const tests = doc.match(/^## Tests\n([\s\S]*?)(?=^## )/m)?.[1] ?? '';
const para = (term) => tests.split(/\n\s*\n/).find((p) => p.includes(term)) ?? '';

test('the Tests section exists', () => assert.ok(tests.length > 0));

test('a test that runs other tests runs only the ones it needs, by name, and checks each ran', () => {
  const p = para('onlyTests');
  for (const term of ['runs another test', 'only the tests', 'onlyTests', 'ranTests', 'ran', 'name pattern', 'matches nothing'])
    assert.ok(p.includes(term), `the rule names "${term}": ${p}`);
});

test('a copy of the repo leaves bench/, tournaments/ and node_modules uncopied', () => {
  const p = para('tournaments/');
  for (const term of ['copy of the repo', 'bench/', 'tournaments/', 'node_modules', 'rather than copying'])
    assert.ok(p.includes(term), `the rule names "${term}": ${p}`);
});

test('a test writes only under its own temp folder, not in or beside the checkout', () => {
  const p = para('temp folder');
  for (const term of ['writes only', 'temp folder', 'checkout', 'beside']) assert.ok(p.includes(term), `the rule names "${term}": ${p}`);
});

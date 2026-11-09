// docs/language.md has a glossary row for guard and one for proof, each naming where the thing lives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const rows = readFileSync(join(REPO, 'docs', 'language.md'), 'utf8').split('\n')
  .filter((l) => l.startsWith('| ')).map((l) => l.split('|').slice(1, -1).map((c) => c.trim()));
const row = (term) => rows.find((r) => r[0] === term);

test('guard: a test run on every PR, living under test/, scripts/, packages/ and plugins/, run by npm test', () => {
  const r = row('guard');
  assert.ok(r, 'a row for guard');
  assert.match(r[1], /every PR/);
  for (const dir of ['test/', 'scripts/', 'packages/', 'plugins/']) assert.ok(r[1].includes(dir), `names ${dir}`);
  assert.match(r[2], /npm test/);
});

test("proof: a verifier's test for one Expect line, living under verify/<item>/, run by the verdict gate", () => {
  const r = row('proof');
  assert.ok(r, 'a row for proof');
  assert.match(r[1], /verifier/);
  assert.match(r[1], /Expect line/);
  assert.match(r[2], /verify\/<item>\//);
  assert.match(r[2], /pr-gate\.mjs/);
});

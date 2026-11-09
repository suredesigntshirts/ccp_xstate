// Each question threads kept asking stays answered where test/notes-questions.json says: its home file holds every
// term that carries the answer. Terms are matched one by one, case and line breaks ignored, so a rewording that keeps
// the answer stays green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const { questions } = JSON.parse(readFileSync(join(REPO, 'test/notes-questions.json'), 'utf8'));
const flat = (text) => text.replace(/\s+/g, ' ').toLowerCase();

test('every harvested question has a home and terms', () => {
  assert.ok(questions.length > 0);
  for (const { q, home, terms } of questions) assert.ok(q && home && terms?.length, `incomplete entry: ${q}`);
});

for (const { q, home, terms } of questions) {
  test(`answered in ${home}: ${q}`, () => {
    const text = flat(readFileSync(join(REPO, home), 'utf8'));
    const missing = terms.filter((t) => !text.includes(flat(t)));
    assert.deepEqual(missing, [], `${home} no longer answers "${q}"`);
  });
}

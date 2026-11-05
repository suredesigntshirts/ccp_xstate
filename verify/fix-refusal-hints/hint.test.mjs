// Expect hint: refusals of a result keep main's { rule, reason } and add fix.hint, each line `<field>: ` and that
// field's ## Output line from workflows/quick-fix/<stage>.md, read here from the stage file itself.
// evidence/main-refusals.json is the same scenarios run on main (bbcdadc) with lib.mjs hintScenarios(<main checkout>).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, hintScenarios, outputLine } from './lib.mjs';

const MAIN = JSON.parse(readFileSync(join(HERE, 'evidence', 'main-refusals.json'), 'utf8'));

test('hint: short pr.at, two fields, build prose url and covers each get the named fields\' Output lines', async () => {
  const got = await hintScenarios();
  for (const k of Object.keys(MAIN)) assert.deepEqual(got[k].refused, MAIN[k].refused, `${k}: refused is main's`);
  assert.equal(got.shortAt.refused.rule, 'schema');
  assert.match(got.shortAt.refused.reason, /result\.pr\.at/);
  assert.deepEqual(got.shortAt.fix.hint, [`pr: ${outputLine('verify', 'pr')}`]);
  assert.deepEqual([...got.twoFields.fix.hint].sort(), [`lines: ${outputLine('verify', 'lines')}`, `pr: ${outputLine('verify', 'pr')}`].sort());
  assert.equal(got.twoFields.fix.hint.length, 2, 'no hint for issue or result');
  assert.equal(got.buildProse.refused.rule, 'schema');
  assert.deepEqual(got.buildProse.fix.hint, [`pr: ${outputLine('build', 'pr')}`]);
  assert.notEqual(outputLine('build', 'pr'), outputLine('verify', 'pr'), 'the build stage\'s own pr line, not verify\'s');
  assert.equal(got.covers.refused.rule, 'covers');
  assert.deepEqual(got.covers.fix.hint, [`lines: ${outputLine('verify', 'lines')}`]);
  for (const k of Object.keys(got)) assert.equal(got[k].fix.cap, 10, k);
});

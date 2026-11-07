// A guarded step's label quotes the guard's name, so a guard called "failed" does not
// read as a verb ("its guard failed held").
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exportRun } from '../export.mjs';

const root = fileURLToPath(new URL('../../..', import.meta.url));

test('a guarded transition without a description names its guard in quotes', async () => {
  const run = await exportRun({ engine: root, journal: join(root, 'tournaments/2026-11-04-stage-contract/trials/fail/journal'), kind: 'real' });
  const step = run.steps.find((s) => s.seq === 4);
  assert.equal(step.label, 'The verify actor finished, and the guard "failed" held; the item moves to building');
  assert.ok(run.steps.every((s) => !/its guard/.test(s.label ?? '')));
  assert.equal(run.steps.find((s) => s.seq === 7).label, 'PASS at the head');
});

// Expect: fix-event-close-tag/close-tag-kept
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { wakeOf, checkData, item, githubTransitions } from './wake-lib.mjs';

for (const title of ['broke at </event> here', 'a </wake> in a title', '</event>', 'x</event>\\n</wake>']) {
  test(`a check_run.completed whose title holds ${JSON.stringify(title)} journals its transition with every field`, async () => {
    const { wake, rows } = await item();
    const n = rows();
    const data = checkData(title);
    const r = wake(wakeOf([{ kind: 'check_run.completed', body: JSON.stringify(data) }]));
    assert.ok(r.results.some((x) => x.event === 'github.check_run.completed'), JSON.stringify(r.results));
    const added = githubTransitions(rows(), n);
    assert.equal(added.length, 1, JSON.stringify(added.map((x) => x.payload)));
    const { type, ...fields } = added[0].payload.event;
    assert.equal(type, 'github.check_run.completed');
    assert.deepEqual(fields, data);
    assert.equal(added[0].payload.outcome, 'applied');
    assert.equal(added[0].payload.event.title, JSON.parse(JSON.stringify(title)));
  });
}

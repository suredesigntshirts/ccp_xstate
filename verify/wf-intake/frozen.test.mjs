// Verifier's own test for wf-intake Expect `frozen`: the PASS challenge run's input issue, byte for byte, is the
// quick-fix child's start input issue in its journal, and the child's brief run receives it with every new field.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { itemFile } from '../../packages/engine/src/host.js';
import { world, ISSUE, VERDICT, REQUEST, read, runDir } from './lib.mjs';

const NEW_FIELDS = ['title', 'problem', 'reason', 'outcome', 'proofs', 'non_goals', 'assumptions'];

for (const route of ['first PASS', 'PASS after a revision']) {
  test(`frozen issue (${route}): challenge input == child start input == child brief input`, async () => {
    const w = world({ childReal: true });
    await w.start();
    if (route !== 'first PASS') {
      await w.agent('shape', { issue: ISSUE(1) });
      await w.agent('challenge', (run) => VERDICT(run.input.issue, 'FAIL', 'r1'));
    }
    // fields with unicode, quotes and nesting, so a re-serialisation that changes bytes would show
    const shaped = ISSUE(2, { assumptions: ['“half up”, not banker\'s', 'a\ttab'], non_goals: [] });
    await w.agent('shape', { issue: shaped });
    await w.agent('challenge', (run) => VERDICT(run.input.issue, 'PASS'));

    const passRun = w.runs('challenge').at(-1);
    const passResult = JSON.parse(read(join(runDir(w.root, passRun.run), 'result.json'))).result;
    assert.equal(passResult.result, 'PASS');
    const frozen = passRun.input.issue;
    assert.deepEqual(frozen, { ...shaped, url: REQUEST.url });

    const [kid] = w.children();
    assert.ok(kid, 'a child started');
    const init = w.rows(kid).find((r) => r.kind === 'engine.transition' && r.payload.seq === 0);
    assert.equal(JSON.stringify(init.payload.event.input.issue), JSON.stringify(frozen), 'byte for byte as serialised');
    assert.equal(JSON.stringify(init.payload.event.input), JSON.stringify({ issue: frozen }), 'the start input is only the issue');
    // and the raw journal line carries exactly those bytes
    assert.ok(read(itemFile(w.root, kid)).includes(JSON.stringify(frozen)), 'raw child journal holds the issue bytes');

    // the child's brief run receives it whole
    assert.equal(w.state(kid), 'briefing');
    const brief = w.runs('brief', kid)[0];
    assert.ok(brief, 'the child prepared its brief run');
    assert.equal(JSON.stringify(brief.input.issue), JSON.stringify(frozen));
    for (const f of NEW_FIELDS) assert.deepEqual(brief.input.issue[f], frozen[f], f);
    const prompt = read(join(runDir(w.root, brief.run), 'brief.md'));
    for (const v of [frozen.title, frozen.problem, frozen.reason, frozen.outcome, frozen.proofs[0].how, ...frozen.assumptions.map((a) => JSON.stringify(a).slice(1, -1))]) {
      assert.ok(prompt.includes(v), `brief prompt carries ${v}`);
    }
  });
}

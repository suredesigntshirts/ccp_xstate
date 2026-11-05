// Expect restated: a restated refusal names every differing key path with the returned value and the input's, a key
// the input lacks as not in the input, values cut to 200 characters; the exact echo is then accepted.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ISSUE, at, engineOf, verifyResult } from './lib.mjs';

test('restated: one line, an added key, url and a line, a long value; then the echo is accepted', async () => {
  const E = await engineOf();
  const w = await E.makeWorld();
  try {
    await at(E, w, 'r1', 'verifying');
    const ret = (issueOf) => w.agent('r1', 'verify', verifyResult(w, (r) => ({ ...r, issue: issueOf(structuredClone(r.issue)) })), 'ag-r1');

    const changed = 'clamp throws a TypeError when lo > hi';
    const one = await ret((i) => { i.expect[1] = changed; return i; });
    assert.equal(one.refused.rule, 'restated');
    assert.ok(one.refused.reason.includes(`result.issue.expect[1] is ${JSON.stringify(changed)}`), one.refused.reason);
    assert.ok(one.refused.reason.includes(`the input's issue.expect[1] is ${JSON.stringify(ISSUE.expect[1])}`), one.refused.reason);
    assert.ok(!one.refused.reason.includes('expect[0]') && !one.refused.reason.includes('expect[2]'), 'only the differing line');
    assert.ok(one.fix.hint.some((h) => h.startsWith('issue: ')), 'restated gets the issue hint');

    const added = await ret((i) => ({ ...i, labels: ['bug'] }));
    assert.equal(added.refused.rule, 'restated');
    assert.match(added.refused.reason, /result\.issue\.labels is not in the input/);

    const both = await ret((i) => ({ ...i, url: 'https://github.com/o/r/issues/43', expect: [i.expect[0], changed, i.expect[2]] }));
    assert.equal(both.refused.rule, 'restated');
    assert.match(both.refused.reason, /result\.issue\.url is "https:\/\/github\.com\/o\/r\/issues\/43"/);
    assert.match(both.refused.reason, /result\.issue\.expect\[1\] is/);

    const long = 'x'.repeat(500);
    const cut = await ret((i) => { i.expect[2] = long; return i; });
    assert.equal(cut.refused.rule, 'restated');
    const shown = cut.refused.reason.match(/result\.issue\.expect\[2\] is (.*?), the input's/)[1];
    assert.ok(shown.length <= 201 && shown.length >= 200, `cut to 200 (+ ellipsis): ${shown.length}`);
    assert.ok(!cut.refused.reason.includes('x'.repeat(250)));

    const ok = await ret((i) => i);
    assert.ok(ok.accepted, JSON.stringify(ok));
  } finally { await w.close(); }
});

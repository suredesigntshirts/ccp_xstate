// Expect key-order: a result whose object keys come in another order at any depth is answered accepted when
// result.json was written by accept() for the first order.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { REPO, PR_URL, stubGitHub, atBuild, ret, toVerify, textOf } from './lib.mjs';

// Every object's keys reversed, at every depth; arrays keep their order.
const reversed = (v) => Array.isArray(v) ? v.map(reversed) : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).reverse().map((k) => [k, reversed(v[k])])) : v;

test('key-order: keys reordered at every depth are still the accepted result', async () => {
  const gh = await stubGitHub();
  try {
    const p = await atBuild(REPO, gh);
    gh.state.head = p.commit();
    const good = { pr: { url: PR_URL, at: gh.state.head }, notes: 'clamp added' };
    assert.equal(await ret(p, good), null);
    const r = reversed(good);
    assert.notEqual(JSON.stringify(r), JSON.stringify(good));
    assert.match(textOf(await p.call({ run: p.run, result: r })), /^accepted: /, 'build result, keys reversed');
    assert.match(textOf(await p.call({ run: p.run, result: { notes: good.notes, pr: good.pr } })), /^accepted: /, 'top level only');

    const v = await toVerify(p);
    const verdict = v.verdict();
    assert.equal(await v.send(verdict), null);
    const rv = reversed(verdict);
    assert.notEqual(JSON.stringify(rv.lines[0]), JSON.stringify(verdict.lines[0]), 'the lines entries are reordered too');
    assert.notEqual(JSON.stringify(rv.issue), JSON.stringify(verdict.issue));
    assert.match(textOf(await p.call({ run: v.run, result: rv })), /^accepted: /, 'verify result, keys reversed at every depth');
    const deep = structuredClone(verdict);
    deep.lines = deep.lines.map(({ line, result, evidence }) => ({ evidence, line, result }));
    assert.match(textOf(await p.call({ run: v.run, result: deep })), /^accepted: /, 'only the lines entries reordered');
    // A reorder of the hook's input instead: a fresh build accepted with keys reversed, answered for the first order.
    const gh2 = await stubGitHub();
    try {
      const q = await atBuild(REPO, gh2);
      gh2.state.head = q.commit();
      const g2 = { pr: { url: PR_URL, at: gh2.state.head }, notes: 'x' };
      assert.equal(await ret(q, reversed(g2)), null);
      assert.match(textOf(await q.call({ run: q.run, result: g2 })), /^accepted: /, 'hook got one order, server the other');
    } finally { await gh2.close(); }
  } finally { await gh.close(); }
});

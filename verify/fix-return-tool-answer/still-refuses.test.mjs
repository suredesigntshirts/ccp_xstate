// Expect still-refuses: after an accepted return, the server still answers not accepted to any other result for that
// run, to the stamped result itself, and to a run with no result.json; a result.json holding only result and hash (as
// written before this change, and as verify/engine-actors writes it) is still accepted for exactly that result.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, PR_URL, stubGitHub, atBuild, ret, toVerify, textOf } from './lib.mjs';

const refused = (a, why) => {
  assert.equal(a.isError, true, why);
  assert.match(textOf(a), /^not accepted: no harness check passed this result for run /, why);
};
const accepted = (a, why) => {
  assert.equal(a.isError, undefined, why);
  assert.match(textOf(a), /^accepted: /, why);
};

test('still-refuses: one changed value, the stamped key added, the stamped result, a run with no result.json', async () => {
  const gh = await stubGitHub();
  try {
    const p = await atBuild(REPO, gh);
    const head = p.commit();
    gh.state.head = head;
    const good = { pr: { url: PR_URL, at: head }, notes: 'clamp added' };
    assert.equal(await ret(p, good), null);
    const call = (result, run = p.run) => p.call({ run, result });
    accepted(await call(good), 'the accepted result');
    refused(await call({ ...good, pr: { ...good.pr, at: 'e'.repeat(40) } }), 'pr.at changed');
    refused(await call({ ...good, pr: { ...good.pr, at: head.toUpperCase() } }), 'pr.at in capitals');
    refused(await call({ ...good, pr: { ...good.pr, url: 'https://github.com/o/r/pull/2' } }), 'pr.url changed');
    refused(await call({ ...good, notes: 'clamp added.' }), 'notes changed');
    refused(await call({ pr: good.pr }), 'notes left out');
    refused(await call({ ...good, pr: { ...good.pr, key: 'o/r#1' } }), 'the stamped key added by the agent');
    refused(await call(p.resultJson().result), 'the stamped result itself');
    refused(await call(good, 'it-1:1.verify'), 'another run name');

    const v = await toVerify(p);
    const verdict = v.verdict();
    refused(await call(verdict, v.run), 'the verify run before any return: no result.json');
    assert.equal(await v.send(verdict), null);
    accepted(await call(verdict, v.run), 'the accepted verify result');
    const lines = structuredClone(verdict.lines);
    lines[1].evidence += ' (again)';
    refused(await call({ ...verdict, lines }, v.run), 'a lines entry evidence changed');
    const l2 = structuredClone(verdict.lines);
    l2[0].result = 'FAIL';
    refused(await call({ ...verdict, lines: l2 }, v.run), 'a lines entry result changed');
    refused(await call({ ...verdict, lines: [...verdict.lines].reverse() }, v.run), 'lines reordered (an array, so order counts)');
    refused(await call({ ...verdict, pr: { ...verdict.pr, at: head.slice(0, 39) + 'x' } }, v.run), 'verify pr.at changed');
    refused(await call({ ...verdict, issue: { ...verdict.issue, title: 'Add clamp' } }, v.run), 'issue title added');
    refused(await call(verdict, p.run), 'the verify result under the build run');
  } finally { await gh.close(); }
});

test('still-refuses: a hand-written result.json with only result and hash is accepted for exactly that result', async () => {
  const gh = await stubGitHub();
  try {
    const p = await atBuild(REPO, gh);
    const result = { pr: { url: PR_URL, at: 'a'.repeat(40), key: 'o/r#1' }, notes: 'n' };
    const hash = createHash('sha256').update(JSON.stringify(result)).digest('hex');
    const dir = join(p.root, 'items', 'it-1', 'runs', '7.build');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ result, hash }));
    accepted(await p.call({ run: 'it-1:7.build', result }), 'exactly that result');
    refused(await p.call({ run: 'it-1:7.build', result: { ...result, notes: 'm' } }), 'one value changed');
    refused(await p.call({ run: 'it-1:7.build', result: { notes: 'n', pr: result.pr } }), 'old files keep the plain hash, so key order counts there');
    writeFileSync(join(dir, 'result.json'), JSON.stringify({ result, hash, sent: 'f'.repeat(64) }));
    refused(await p.call({ run: 'it-1:7.build', result }), 'with sent present, hash is not used');
  } finally { await gh.close(); }
});

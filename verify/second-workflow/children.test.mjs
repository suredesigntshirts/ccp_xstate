// children: bin/host.js drives a feature item and its quick-fix child items, with stub agents and a GitHub stub.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemFile } from '../../packages/engine/src/names.js';
import { world, host, prompt, returned, githubStub, checkSuite, grant } from './lib.mjs';

const sha = (c) => c.repeat(40);
const ISSUE = { url: 'https://github.com/o/r/issues/1', expect: ['the feature works'] };
const SLICES = [1, 2, 3].map((n) => ({ url: `${ISSUE.url}#s${n}`, expect: [`slice ${n} works`] }));
const prOf = (n) => ({ url: `https://github.com/o/r/pull/${10 + n}`, key: `o/r#${10 + n}` });
const pass = (url, at, issue) => ({ result: 'PASS', pr: { url, at }, issue, lines: issue.expect.map((line) => ({ line, result: 'PASS', evidence: 'ran it' })) });
const TOP = ['--item', 'feat', '--workflow', 'feature'];
const F = 'feat:4.final';

// What one call did, keyed for asserting: [item or 'top', event, outcome, source system].
const did = (out) => out.results.map((r) => [r.item ?? 'top', r.event, r.outcome, r.source.system]);
const rows = (root, item) => readFileSync(itemFile(root, item), 'utf8').trim().split('\n').map(JSON.parse);

test('a feature item runs from start to done through bin/host.js, its three slices and final child included', async (t) => {
  const w = world();
  const gh = await githubStub();
  t.after(() => gh.close());
  const env = { CCP_GITHUB_API: gh.url };
  const wake = (text = 'go on') => host(w, ['wake', ...TOP], { stdin: prompt('owner', text), env });
  const ok = (r) => {
    assert.equal(r.status, 0, r.stderr);
    return r.out;
  };

  let out = ok(await host(w, ['start', ...TOP, '--session', 'owner', '--input', JSON.stringify({ issue: ISSUE, branch: 'build/feat' })], { env }));
  assert.equal(out.state, 'planning');
  assert.deepEqual(out.waiting.map((x) => [x.item ?? 'top', x.run]), [['top', 'feat:0.brief']]);

  // The plan's result starts three child items in the same call, each on quick-fix, each with its brief waiting.
  returned(w.root, 'feat:0.brief', { slices: SLICES });
  out = ok(await wake());
  assert.equal(out.state, 'slicing');
  assert.deepEqual(out.children.map((c) => [c.item, c.workflow.split('@')[0], c.state]), [
    ['feat:1.s1', 'quick-fix', 'briefing'], ['feat:1.s2', 'quick-fix', 'briefing'], ['feat:1.s3', 'quick-fix', 'briefing']
  ]);
  assert.deepEqual(out.waiting.map((x) => [x.item, x.run, x.prompt]), [1, 2, 3].map((n) => [`feat:1.s${n}`, `feat:1.s${n}:0.brief`, `ccp-run feat:1.s${n}:0.brief`]));
  for (const n of [1, 2, 3]) {
    const [first] = rows(w.root, `feat:1.s${n}`);
    assert.deepEqual(first.payload.event.input.issue, SLICES[n - 1]);
    assert.equal(first.payload.event.input.base, 'build/feat');
    assert.deepEqual(first.payload.event.input.decision, { choice: 'approve', by: 'feature' });
  }

  // One wake hands each child its own result.
  for (const n of [1, 2, 3]) returned(w.root, `feat:1.s${n}:0.brief`, { builder: `build ${n}`, verifier: `verify ${n}` });
  out = ok(await wake());
  assert.deepEqual(did(out), [1, 2, 3].map((n) => [`feat:1.s${n}`, 'xstate.done.actor.brief', 'applied', 'harness']));
  assert.deepEqual(out.children.map((c) => c.state), ['building', 'building', 'building']);

  // s1 and s2 come back green; s3 before CI reported, so it waits in checking.
  returned(w.root, 'feat:1.s1:1.build', { pr: { url: prOf(1).url, at: sha('1'), key: prOf(1).key, green: true }, notes: 'built' });
  returned(w.root, 'feat:1.s2:1.build', { pr: { url: prOf(2).url, at: sha('2'), key: prOf(2).key, green: true }, notes: 'built' });
  returned(w.root, 'feat:1.s3:1.build', { pr: { url: prOf(3).url, at: sha('3'), key: prOf(3).key }, notes: 'built' });
  out = ok(await wake());
  assert.deepEqual(out.children.map((c) => c.state), ['verifying', 'verifying', 'checking']);

  // A GitHub wake is offered to the top item and every open child: only s3's PR takes it.
  out = ok(await wake(checkSuite(prOf(3).key, sha('3'))));
  assert.deepEqual(did(out), [
    ['top', 'github.check_suite.completed', 'refused', 'github'],
    ['feat:1.s1', 'github.check_suite.completed', 'refused', 'github'],
    ['feat:1.s2', 'github.check_suite.completed', 'refused', 'github'],
    ['feat:1.s3', 'github.check_suite.completed', 'applied', 'github']
  ]);
  assert.equal(out.children[2].state, 'verifying');

  // Two PASSes: each child merges on the feature's grant (no ask) and its end reaches the parent in the same call.
  returned(w.root, 'feat:1.s1:2.verify', pass(prOf(1).url, sha('1'), SLICES[0]));
  returned(w.root, 'feat:1.s2:2.verify', pass(prOf(2).url, sha('2'), SLICES[1]));
  out = ok(await wake());
  assert.deepEqual(did(out), [
    ['feat:1.s1', 'xstate.done.actor.verify', 'applied', 'harness'], ['feat:1.s1', 'xstate.done.actor.merge', 'applied', 'engine'],
    ['feat:1.s2', 'xstate.done.actor.verify', 'applied', 'harness'], ['feat:1.s2', 'xstate.done.actor.merge', 'applied', 'engine'],
    ['top', 'xstate.done.actor.s1', 'applied', 'item'], ['top', 'xstate.done.actor.s2', 'applied', 'item']
  ]);
  assert.equal(out.state, 'slicing');
  assert.deepEqual(out.children.map((c) => c.item), ['feat:1.s3']);

  // The last slice's end moves the feature to finishing, which starts the final child in that same call.
  returned(w.root, 'feat:1.s3:3.verify', pass(prOf(3).url, sha('3'), SLICES[2]));
  out = ok(await wake());
  assert.equal(out.state, 'finishing');
  assert.deepEqual(did(out).at(-1), ['top', 'xstate.done.actor.s3', 'applied', 'item']);
  assert.deepEqual(out.children.map((c) => [c.item, c.state]), [[F, 'briefing']]);
  assert.deepEqual(gh.calls.map((c) => [c.method, c.path, c.body.sha]), [1, 2, 3].map((n) => ['PUT', `/repos/o/r/pulls/${10 + n}/merge`, sha(String(n))]));

  // The final child has no grant, so a PASS asks to merge: its ask run is the child's, named under children.
  returned(w.root, `${F}:0.brief`, { builder: 'return the build PR', verifier: 'check the goal' });
  ok(await wake());
  const prF = { url: 'https://github.com/o/r/pull/20', key: 'o/r#20' };
  returned(w.root, `${F}:1.build`, { pr: { url: prF.url, at: sha('a'), key: prF.key, green: true }, notes: 'the build PR' });
  ok(await wake());
  returned(w.root, `${F}:2.verify`, pass(prF.url, sha('a'), ISSUE));
  out = ok(await wake());
  assert.equal(out.children[0].state, 'awaitingMerge');
  assert.deepEqual(out.children[0].pending.runs.map((r) => [r.id, r.actor]), [[`${F}:3.ask`, 'ask']]);
  assert.deepEqual(out.pending.runs.map((r) => r.id), [F]);

  // card names the child's ask run by its effect id; a run outside the tree is refused.
  const stray = await host(w, ['card', ...TOP, '--effect', 'other:0.ask', '--ref', 'cmsg_x'], { env });
  assert.equal(stray.status, 2);
  assert.match(stray.stderr, /is not a run of feat or of an open child item of it/);
  out = ok(await host(w, ['card', ...TOP, '--effect', `${F}:3.ask`, '--ref', 'cmsg_card1'], { env }));
  assert.equal(out.ref, 'cmsg_card1');

  // The head moves: the child leaves the state that asked, its ask's stop is pending, and closed finishes it.
  out = ok(await wake(checkSuite(prF.key, sha('b'))));
  assert.equal(out.children[0].state, 'verifying');
  assert.deepEqual(out.children[0].pending.effects.map((e) => [e.type, e.run]), [['stop', `${F}:3.ask`]]);
  out = ok(await host(w, ['closed', ...TOP, '--effect', `${F}:3.ask`], { env }));
  assert.equal(out.stop, `${F}:3.ask:stop`);
  out = ok(await host(w, ['show', ...TOP], { env }));
  assert.deepEqual(out.children[0].pending.effects, []);

  // A PASS on the new head asks again; answer (a stand-in under a grant) on the child's run merges it, and the
  // child's end ends the feature in the same call.
  returned(w.root, `${F}:4.verify`, pass(prF.url, sha('b'), ISSUE));
  out = ok(await wake());
  const ask = out.children[0].pending.runs[0].id;
  assert.equal(ask, `${F}:5.ask`);
  grant(w, [{ id: 'g1', workflow: 'quick-fix', ask: 'ask', choices: ['approve'], repos: ['o/r'], until: '2099-01-01T00:00:00Z', granted_by: 'verifier', said: 'test' }]);
  const early = await host(w, ['answer', ...TOP, '--effect', ask, '--choice', 'approve', '--by', 'standin', '--grants', w.grants], { env });
  assert.equal(early.status, 2);
  assert.match(early.stderr, /card for .* is not up yet/);
  ok(await host(w, ['card', ...TOP, '--effect', ask, '--ref', 'cmsg_card2'], { env }));
  out = ok(await host(w, ['answer', ...TOP, '--effect', ask, '--choice', 'approve', '--by', 'standin', '--grants', w.grants], { env }));
  assert.deepEqual(did(out), [
    [F, 'xstate.done.actor.ask', 'applied', 'standin'], [F, 'xstate.done.actor.merge', 'applied', 'engine'], ['top', 'xstate.done.actor.final', 'applied', 'item']
  ]);
  assert.equal(out.state, 'done');
  assert.deepEqual(out.children, []);
  assert.deepEqual(gh.calls.at(-1), { method: 'PUT', path: '/repos/o/r/pulls/20/merge', body: { sha: sha('b'), merge_method: 'merge' } });
  const end = rows(w.root, 'feat').filter((r) => r.kind === 'engine.transition' && r.payload.outcome === 'applied').at(-1);
  assert.deepEqual(end.payload.event.output.merge, { sha: '20'.padStart(40, 'c') });
});

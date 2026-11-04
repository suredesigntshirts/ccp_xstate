// The card relay (plan item engine-toy-run): a command-line host's card waits until the session that can post it
// records the card's id, and only the platform's tap wake on that card answers it.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { restore, offer, pending } from '../src/index.js';
import { handlers, relay, recordCard, recordClosed, cardFile } from '../src/effects/index.js';
import { readFile } from '../../journal/src/index.js';
import { workflow, ISSUE, BRIEFS, A, pr, verdict } from './flow.js';
import { loadWorkflow } from '../src/index.js';

const cli = new URL('../bin/host.js', import.meta.url).pathname;
const fresh = () => mkdtempSync(join(tmpdir(), 'engine-relay-'));
const CARD = 'cmsg_01CardPostedByTheThread';
// A tap wake as the platform delivers it (plugins/harness/test/fixtures/attention/tap-wake.txt), on CARD.
const tap = (card, index = 0, option = 'A') => readFileSync(new URL('../../../plugins/harness/test/fixtures/attention/tap-wake.txt', import.meta.url), 'utf8')
  .replace(/decision_id=[^<]*/, `decision_id=${card}`)
  .replace(/option=[^<]*/, `option=${option}`)
  .replace(/option_index=[^<]*/, `option_index=${index}`);

// An item of quick-fix taken to awaitingMerge on head A, its brief, build and verify done by stand-in actors.
async function toAwaitingMerge(root) {
  // Loaded with the root, so the workflow's pinned bytes are there for bin/host.js (workflowOf) to load the item on.
  const host = restore({ root, item: 'it-1', spec: loadWorkflow('quick-fix', { root }), session: 'owner', release: '0.2.0' });
  const outputs = { brief: BRIEFS, build: pr(A), verify: verdict('PASS', A) };
  const actors = Object.fromEntries(Object.entries(outputs).map(([name, output]) => [name, { start: async (e) => ({ ref: e.id, output }) }]));
  await offer(host, [{ event: { type: 'xstate.init', input: { issue: ISSUE } }, source: { system: 'claude-code', ref: 'owner' } }],
    handlers({ hearth: relay({ root }), actors }));
  return host;
}
const askRun = (host) => pending(host).runs.find((r) => r.actor === 'ask');

test('a card with no record stays pending: no effect row, no ref', async () => {
  const root = fresh();
  const host = await toAwaitingMerge(root);
  assert.equal(host.snapshot.value, 'awaitingMerge');
  const ask = askRun(host);
  assert.ok(ask, 'the ask run is open');
  const rows = readFile(host.file).rows.filter((r) => r.kind === 'engine.effect' && r.payload.effect === ask.id);
  assert.deepEqual(rows, []);
});

test('recordCard refuses a run that is not an open ask run, an empty id, and a second record', async () => {
  const root = fresh();
  const host = await toAwaitingMerge(root);
  const ask = askRun(host);
  assert.throws(() => recordCard({ host, effect: 'it-1:0.brief', ref: CARD }), /not an open ask run/);
  assert.throws(() => recordCard({ host, effect: ask.id, ref: ' ' }), /needs its id/);
  const record = recordCard({ host, effect: ask.id, ref: CARD });
  assert.equal(record.question, 'Merge this PR at the verified commit?');
  assert.deepEqual(record.choices, ['approve', 'reject']);
  assert.ok(existsSync(cardFile(root, ask.id)));
  assert.throws(() => recordCard({ host, effect: ask.id, ref: 'cmsg_other' }), /already recorded/);
});

// A GitHub that merges PR 1 of o/r at head A only.
async function fakeGitHub() {
  const merges = [];
  const server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const reply = (status, json) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(json)); };
      if (req.method === 'GET') return reply(200, { number: 1, merged: merges.length > 0, merge_commit_sha: merges.length ? 'd'.repeat(40) : null, head: { sha: A } });
      const { sha } = JSON.parse(body || '{}');
      merges.push(sha);
      return sha === A ? reply(200, { sha: 'd'.repeat(40), merged: true }) : reply(409, { message: 'Head branch was modified.' });
    });
  });
  await new Promise((ok) => server.listen(0, '127.0.0.1', ok));
  return { merges, api: `http://127.0.0.1:${server.address().port}`, close: () => new Promise((ok) => { server.closeAllConnections(); server.close(ok); }) };
}

// Run asynchronously: the fake GitHub answers from this process, so a blocking spawn would deadlock.
const hostCli = (root, args, { input = '', env = {} } = {}) => new Promise((ok, no) => {
  const child = spawn(process.execPath, [cli, ...args, '--item', 'it-1', '--workflow', 'quick-fix', '--root', root, '--release', '0.2.0'],
    { env: { ...process.env, ...env } });
  let stdout = '', stderr = '';
  child.stdout.on('data', (d) => (stdout += d));
  child.stderr.on('data', (d) => (stderr += d));
  child.on('error', no);
  child.on('close', (status) => {
    try {
      assert.equal(status, 0, stderr);
      ok(JSON.parse(stdout));
    } catch (error) {
      no(error);
    }
  });
  child.stdin.end(input);
});

test('bin/host.js: a tap before the card is recorded matches nothing; after `card`, the tap merges at the verdict sha', async () => {
  const root = fresh();
  const host = await toAwaitingMerge(root);
  const ask = askRun(host);
  const gh = await fakeGitHub();
  try {
    // The fake API is reached by plain HTTP; the client is pointed at it the way the actor hook's is.
    const env = { CCP_GITHUB_API: gh.api };
    const wake = (prompt) => hostCli(root, ['wake'], { input: JSON.stringify({ session_id: 'owner', hook_event_name: 'UserPromptSubmit', prompt }), env });

    const early = await wake(tap(CARD));
    assert.deepEqual(early.results, [], 'no run has this card yet');
    assert.equal(early.state, 'awaitingMerge');

    const record = await hostCli(root, ['card', '--effect', ask.id, '--ref', CARD]);
    assert.equal(record.ref, CARD);
    const done = readFile(host.file).rows.filter((r) => r.kind === 'engine.effect' && r.payload.effect === ask.id && r.payload.phase === 'done');
    assert.equal(done.at(-1)?.payload.outcome.ref, CARD, '`card` finishes the card effect at once, so the item\'s file names the card');

    // Another card's tap is not this run's answer.
    assert.deepEqual((await wake(tap('cmsg_someOtherCard'))).results.filter((r) => r.event?.startsWith('xstate.done.actor.ask')), []);

    const got = await wake(tap(CARD));
    const answer = got.results.find((r) => r.event === 'xstate.done.actor.ask');
    assert.equal(answer.outcome, 'applied');
    assert.deepEqual(answer.source, { system: 'hearth', ref: CARD });
    assert.equal(got.state, 'done');
    assert.deepEqual(gh.merges, [A]);
  } finally {
    await gh.close();
  }
});

// fix-finish-closes-waits: a card the item left is closed the way it was put up.
const closedWake = (outcome = 'merged') => `<wake reason="external-event" current-time="2026-10-30T19:27:48Z">
  <event source="github" kind="pull_request.closed" from="system" trust="relay">
    {"outcome":"${outcome}","pr":"o/r#1"}
  </event>
</wake>`;

test('bin/host.js: a card the item left waits as a pending stop until the thread withdraws it and runs `closed`', async () => {
  const root = fresh();
  const host = await toAwaitingMerge(root);
  const ask = askRun(host);
  const wake = (prompt) => hostCli(root, ['wake'], { input: JSON.stringify({ session_id: 'owner', hook_event_name: 'UserPromptSubmit', prompt }) });
  await hostCli(root, ['card', '--effect', ask.id, '--ref', CARD]);

  const left = await wake(closedWake('merged'));
  assert.equal(left.state, 'closedOutside');
  const stop = left.pending.effects.find((e) => e.type === 'stop');
  assert.deepEqual(stop, { id: `${ask.id}:stop`, type: 'stop', run: ask.id, actor: 'ask', transition: stop.transition }, 'show lists the stop of the ask run');
  assert.deepEqual(left.pending.runs, []);

  const record = await hostCli(root, ['closed', '--effect', ask.id]);
  assert.equal(record.ref, CARD);
  const shown = await hostCli(root, ['show']);
  assert.deepEqual(shown.pending.effects, [], 'nothing waits once the card is recorded closed');
  const rows = readFile(host.file).rows.filter((r) => r.kind === 'engine.effect' && r.payload.effect === `${ask.id}:stop`);
  assert.deepEqual(rows.map((r) => r.payload.phase), ['start', 'done']);
  assert.deepEqual(rows.at(-1).payload.outcome, { closed: CARD });
});

test('closed and card refuse what does not fit: no stop waiting, no card to close, a second record, a card for a stopped run', async () => {
  const root = fresh();
  const host = await toAwaitingMerge(root);
  const ask = askRun(host);
  assert.throws(() => recordClosed({ host, effect: ask.id }), /has no stop waiting/);
  // The item leaves the card before the thread recorded it: nothing to close, and the stop ends at once.
  const h = restore({ root, item: 'it-1', spec: loadWorkflow('quick-fix', { root }), session: 'owner', release: '0.2.0' });
  const { inputsOfWake } = await import('../src/index.js');
  await offer(h, inputsOfWake(h, closedWake('closed'), { now: '2999-01-01T00:00:00Z' }), handlers({ hearth: relay({ root }) }));
  assert.equal(h.snapshot.value, 'closedOutside');
  assert.deepEqual(pending(h).effects, [], 'no card was recorded, so the stop had nothing to wait for');
  assert.throws(() => recordCard({ host: h, effect: ask.id, ref: CARD }), /was stopped.*withdraw the card/);
});

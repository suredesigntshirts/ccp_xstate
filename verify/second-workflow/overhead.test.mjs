// overhead: a session's tokens are attributed to the PRs whose commits' Claude-Session trailers name it, in any form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { prFacts } from '../../packages/journal/bin/derive.js';
import { append } from '../../packages/journal/src/index.js';
import { restStub } from './lib.mjs';

const derive = new URL('../../packages/journal/bin/derive.js', import.meta.url).pathname;
const URL_A = 'https://claude.ai/code/session_01AAAAAAAAAAAAAAAAAAAAAAAA';
const ID_A = 'session_01AAAAAAAAAAAAAAAAAAAAAAAA';
const LOCAL = '7cf0a9e6-fa64-572e-9300-c0e6f8d97cda';
const trailer = (session) => `Do a thing\n\nCo-Authored-By: Claude <noreply@anthropic.com>\nClaude-Session: ${session}\n`;

// A session's token rows, as capture writes them (turn.usage at Stop, agent.finish for a subagent), keyed by `session`.
const usage = (session, tokens, agent = null) => ({
  kind: agent ? 'agent.finish' : 'turn.usage', session, item: null, state: null, release: '0.9.0', agent,
  source: { system: 'claude-code', ref: `${agent ? 'SubagentStop' : 'Stop'} ${session}` },
  payload: { tokens: { input: tokens, output: 0, cacheRead: 0, cacheCreation: 0 }, ...(agent ? { agentId: agent } : { messages: 1, models: [], cost: null, fiveHour: null, sevenDay: null }) },
  placeholder: 'test'
});

// Runs `derive.js overhead` over journal rows and PR facts; the config makes plan/ harness and src/ product.
function view(rowsList, facts) {
  const dir = mkdtempSync(join(tmpdir(), 'verify-overhead-'));
  const journal = join(dir, 'session.jsonl');
  for (const r of rowsList) append(journal, r);
  writeFileSync(join(dir, 'facts.json'), JSON.stringify(facts));
  writeFileSync(join(dir, 'config.json'), JSON.stringify({ harness: ['o/r/plan/**'] }));
  return JSON.parse(execFileSync(process.execPath, [derive, 'overhead', '--journal', journal, '--facts', join(dir, 'facts.json'), '--config', join(dir, 'config.json')], { encoding: 'utf8' }));
}

const FILES = [{ path: 'plan/a.md', changes: 30 }, { path: 'src/b.js', changes: 10 }];

for (const [form, written] of [['its URL', URL_A], ['its bare session_ id', ID_A], ['its URL with #agent=<name>', `${URL_A}#agent=builder-2`], ['a local session id', LOCAL]]) {
  for (const [keyed, key] of [['URL', URL_A], ['id', ID_A]]) {
    const session = form === 'a local session id' ? LOCAL : key;
    const label = form === 'a local session id' ? 'its id' : `its ${keyed}`;
    test(`a trailer giving ${form} attributes the session the journal keys by ${label}`, async () => {
      const facts = [await prFacts('o/r', 7, { get: restStub({ 7: { head: 'feature/x', commits: [trailer(written)], files: FILES } }) })];
      assert.deepEqual(facts[0].sessions, [written], 'prFacts keeps the trailer as written');
      const out = view([usage(session, 1000)], facts);
      assert.equal(out.unattributed, 0);
      assert.equal(out.harness, 750);
      assert.equal(out.product, 250);
      const [entry] = Object.values(out.sessions);
      assert.deepEqual(entry.inputs.prs, ['o/r#7']);
      assert.equal(entry.harnessShare, 0.75);
    });
  }
}

test('one session in several forms, across commits and PRs, counts once per PR; subagent tokens count with it', async () => {
  const get = restStub({
    7: { head: 'a', commits: [trailer(URL_A), trailer(`${URL_A}#agent=x`), trailer(ID_A)], files: [{ path: 'plan/a.md', changes: 10 }] },
    8: { head: 'b', commits: [trailer(`${URL_A}#agent=y`)], files: [{ path: 'src/b.js', changes: 10 }] }
  });
  const facts = [await prFacts('o/r', 7, { get }), await prFacts('o/r', 8, { get })];
  assert.equal(facts[0].sessions.length, 3);
  const out = view([usage(URL_A, 600), usage(ID_A, 200), usage(URL_A, 200, 'agent-1')], facts);
  assert.equal(Object.keys(out.sessions).length, 1, 'URL and id rows are one session');
  const [entry] = Object.values(out.sessions);
  assert.equal(entry.tokens, 1000);
  assert.deepEqual(entry.inputs.prs.sort(), ['o/r#7', 'o/r#8']);
  assert.equal(entry.harnessShare, 0.5);
  assert.deepEqual([out.harness, out.product, out.unattributed], [500, 500, 0]);
});

test('old PR facts (the bare session_ part only) still attribute a session keyed by its URL', () => {
  const out = view([usage(URL_A, 400)], [{ repo: 'o/r', number: 9, sessions: [ID_A], files: FILES }]);
  assert.equal(out.unattributed, 0);
  assert.deepEqual(Object.values(out.sessions)[0].inputs.prs, ['o/r#9']);
});

test('a session no trailer names stays unattributed, and another session is not given its tokens', async () => {
  const facts = [await prFacts('o/r', 7, { get: restStub({ 7: { head: 'x', commits: [trailer(URL_A)], files: FILES } }) })];
  const out = view([usage('https://claude.ai/code/session_01BBBBBBBBBBBBBBBBBBBBBBBB', 300), usage('other-local-id', 100), usage(URL_A, 1000)], facts);
  assert.equal(out.unattributed, 400);
  assert.equal(out.harness + out.product, 1000);
  // A trailer whose id merely starts with another's does not match it.
  const prefix = view([usage(`${URL_A}X`, 50)], facts);
  assert.equal(prefix.unattributed, 50);
});

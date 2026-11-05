// Expect block: the owner's Stop is blocked with the exact call; others' Stops, started runs, and the cloud form.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { project, briefRun, engine } from './lib.mjs';

test('block: the owner S is blocked with item, state, run, actor, ccp-run, Block 1 of 2 and the exit; one stall row', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  assert.equal(p.show('a-1').state, 'briefing');
  const out = p.stop('S');
  assert.equal(out.decision, 'block');
  for (const part of ['a-1', 'briefing', run, 'brief', `"ccp-run ${run}"`, 'Block 1 of 2.', `ccp-cannot-start ${run}`]) assert.ok(out.reason.includes(part), `reason holds ${part}: ${out.reason}`);
  const rows = await p.refusals('a-1', 'stall');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].payload.count, 1);
  assert.equal(rows[0].payload.cap, 2);
  assert.equal(rows[0].payload.run, run);
  assert.equal(rows[0].payload.outcome, 'blocked');
  writeFileSync(join(p.base, 'block-reason.txt'), out.reason);
});

test('block: a Stop from T (not the owner) gives no output and no row', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  assert.equal(p.stop('T'), null);
  assert.equal(p.stop('T', { stop_hook_active: true }), null);
  assert.equal((await p.refusals('a-1')).length, 0);
  assert.equal(p.files(briefRun(p, 'a-1')).includes('failed.json'), false);
});

test('block: after the run\'s Agent call (spawn.json) the Stop gives no output and no row', async () => {
  const p = project({ items: ['a-1'], owner: 'S' });
  const run = briefRun(p, 'a-1');
  const pre = p.agent(`ccp-run ${run}`, 'S');
  assert.ok(!pre || pre.hookSpecificOutput?.permissionDecision !== 'deny', JSON.stringify(pre));
  assert.ok(p.files(run).includes('spawn.json'));
  for (let i = 0; i < 4; i++) assert.equal(p.stop('S'), null);
  assert.equal((await p.refusals('a-1')).length, 0);
  assert.equal((await engine()).waiting(p.root, 'a-1').length, 0);
});

test('block: the cloud form (CLAUDE_CODE_REMOTE_SESSION_ID set, run.session the URL) blocks too', async () => {
  const url = 'https://claude.ai/code/session_verifyCloud1';
  const p = project({ items: ['c-1'], owner: url, cloud: 'cse_verifyCloud1' });
  const run = briefRun(p, 'c-1');
  const rec = JSON.parse((await import('node:fs')).readFileSync(join(p.runDir(run), 'run.json'), 'utf8'));
  assert.equal(rec.session, url);
  const out = p.stop('3f0c-local-uuid');
  assert.equal(out?.decision, 'block');
  assert.ok(out.reason.includes('Block 1 of 2.'));
  assert.equal((await p.refusals('c-1', 'stall')).length, 1);
  // Without the cloud variable the same hook session id owns nothing.
  assert.equal(p.stop('3f0c-local-uuid', {}, { CLAUDE_CODE_REMOTE_SESSION_ID: '' }), null);
});

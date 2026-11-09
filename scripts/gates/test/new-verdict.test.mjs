// The verdict skeleton: written in a temp repo holding one item, then read back and checked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { childEnv } from '../../../test/regression/lib.mjs';
import { checkVerdict } from '../lib.mjs';

const SCRIPT = join(import.meta.dirname, '..', 'new-verdict.mjs');
const HEAD = {
  id: 'toy', title: 't', stage: 's', kind: 'build', status: 'done', outcome: 'o', depends_on: [],
  expect: [
    { id: 'seen', check: 'c', how: 'h', proof: 'world' },
    { id: 'tested', check: 'c', how: 'h', proof: 'verifier' },
    { id: 'mutated', check: 'c', how: 'h', proof: 'builder' }
  ]
};

function repo() {
  const dir = mkdtempSync(join(tmpdir(), 'new-verdict-'));
  const git = (...a) => execFileSync('git', ['-C', dir, ...a], { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' }, stdio: 'pipe', encoding: 'utf8' }).trim();
  git('init', '-q');
  mkdirSync(join(dir, 'plan', 'items'), { recursive: true });
  writeFileSync(join(dir, 'plan', 'items', 'toy.md'), `\`\`\`json\n${JSON.stringify(HEAD, null, 2)}\n\`\`\`\n`);
  git('add', '-A');
  git('-c', 'commit.gpgsign=false', '-c', 'user.name=t', '-c', 'user.email=t@example.com', 'commit', '-qm', 'toy');
  return { dir, sha: git('rev-parse', 'HEAD') };
}
const run = (dir, args, add = { CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_0123abc' }) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env: childEnv({ drop: ['CLAUDE_CODE_REMOTE_SESSION_ID'], add }), encoding: 'utf8' });

test('the skeleton names the full head sha, the thread session and one empty result per Expect line with its slots', () => {
  const { dir, sha } = repo();
  const r = run(dir, ['toy', '--model', 'm-1']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Claude-Session: https:\/\/claude\.ai\/code\/session_0123abc$/m);
  const v = JSON.parse(readFileSync(join(dir, 'verify', 'toy', 'verdict.json'), 'utf8'));
  assert.equal(v.item, 'toy');
  assert.equal(v.verified_sha, sha);
  assert.match(v.verified_sha, /^[0-9a-f]{40}$/);
  assert.deepEqual(v.verifier, { session: 'https://claude.ai/code/session_0123abc', model: 'm-1' });
  assert.deepEqual(v.results.map((x) => x.id), ['seen', 'tested', 'mutated']);
  assert.equal(v.results[0].test, undefined);
  assert.equal(v.results[1].test, 'verify/toy/');
  assert.deepEqual([v.results[2].mutation, v.results[2].red_test], ['', '']);
  assert.ok(checkVerdict({ item: 'toy', head: HEAD, verdict: v }).length >= 3, 'the gate refuses the unfilled skeleton');
});

test('it refuses without a session id, and will not replace a verdict unless forced', () => {
  const { dir } = repo();
  const none = run(dir, ['toy'], {});
  assert.equal(none.status, 1);
  assert.match(none.stderr, /CLAUDE_CODE_REMOTE_SESSION_ID/);
  assert.equal(run(dir, ['toy']).status, 0);
  const again = run(dir, ['toy']);
  assert.equal(again.status, 1);
  assert.match(again.stderr, /exists/);
  assert.equal(run(dir, ['toy', '--force']).status, 0);
  assert.equal(run(dir, ['nope']).status, 1);
});

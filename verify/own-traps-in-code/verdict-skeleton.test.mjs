// verdict-skeleton: scripts/gates/new-verdict.mjs in temp repos holding a ready item, then pr-gate.mjs verdict over the
// unfilled skeleton.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { childEnv } from '../../test/regression/lib.mjs';
import { REPO, commit, gitIn, tmp, write } from './lib.mjs';

const SCRIPT = join(REPO, 'scripts', 'gates', 'new-verdict.mjs');
const GATE = join(REPO, 'scripts', 'gates', 'pr-gate.mjs');
const HEAD = {
  id: 'toy', title: 't', stage: 's', kind: 'build', status: 'ready', outcome: 'o', depends_on: [],
  expect: [
    { id: 'seen', check: 'c', how: 'h', proof: 'world' },
    { id: 'tested', check: 'c', how: 'h', proof: 'verifier' },
    { id: 'mutated', check: 'c', how: 'h', proof: 'builder' }
  ]
};
const itemFile = (head) => `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n\n## Verifier brief\n\nRun it.\n`;

function repo() {
  const dir = tmp('verdict');
  gitIn(dir)('init', '-q', '-b', 'main');
  write(dir, 'plan/items/toy.md', itemFile(HEAD));
  const base = commit(dir, 'ready');
  write(dir, 'plan/items/toy.md', itemFile({ ...HEAD, status: 'done' }));
  write(dir, 'packages/a/index.js', 'export const a = 1;\n');
  const built = commit(dir, 'build', 'https://claude.ai/code/session_builder');
  return { dir, base, built, git: gitIn(dir) };
}
const run = (dir, args, add = { CLAUDE_CODE_REMOTE_SESSION_ID: 'cse_01Verifier' }) =>
  spawnSync(process.execPath, [SCRIPT, ...args], { cwd: dir, env: childEnv({ drop: ['CLAUDE_CODE_REMOTE_SESSION_ID'], add }), encoding: 'utf8' });

test('the skeleton holds the full HEAD sha, the session from the environment, one empty result per Expect line, and prints the trailer', () => {
  const { dir, built, git } = repo();
  const r = run(dir, ['toy']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^Claude-Session: https:\/\/claude\.ai\/code\/session_01Verifier$/m);
  const v = JSON.parse(readFileSync(join(dir, 'verify/toy/verdict.json'), 'utf8'));
  assert.equal(v.verified_sha, git('rev-parse', 'HEAD'));
  assert.equal(v.verified_sha, built);
  assert.equal(v.verified_sha.length, 40);
  assert.equal(v.item, 'toy');
  assert.equal(v.verifier.session, 'https://claude.ai/code/session_01Verifier');
  assert.deepEqual(v.results.map((x) => x.id), ['seen', 'tested', 'mutated']);
  for (const x of v.results) assert.deepEqual([x.status, x.command, x.excerpt], ['', '', '']);
  assert.equal('test' in v.results[0], false, 'a world line has no test slot');
  assert.equal(typeof v.results[1].test, 'string');
  assert.ok('test' in v.results[2] && 'mutation' in v.results[2] && 'red_test' in v.results[2], 'a builder line has its slots');
  // A session id given without the cse_ prefix is used as it is.
  const again = run(dir, ['toy', '--force'], { CLAUDE_CODE_REMOTE_SESSION_ID: 'session_02Other' });
  assert.equal(again.status, 0, again.stderr);
  assert.equal(JSON.parse(readFileSync(join(dir, 'verify/toy/verdict.json'), 'utf8')).verifier.session, 'https://claude.ai/code/session_02Other');
});

test('it refuses with no session id, and refuses to overwrite a verdict that exists', () => {
  const { dir } = repo();
  for (const add of [{}, { CLAUDE_CODE_REMOTE_SESSION_ID: '' }]) {
    const r = run(dir, ['toy'], add);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /CLAUDE_CODE_REMOTE_SESSION_ID/);
    assert.equal(existsSync(join(dir, 'verify/toy/verdict.json')), false);
  }
  write(dir, 'verify/toy/verdict.json', '{"mine":true}\n');
  const r = run(dir, ['toy']);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /exists/);
  assert.equal(readFileSync(join(dir, 'verify/toy/verdict.json'), 'utf8'), '{"mine":true}\n');
});

test('the verdict gate refuses the unfilled skeleton, committed from a separate session with the printed trailer', () => {
  const { dir, base, git } = repo();
  const r = run(dir, ['toy']);
  assert.equal(r.status, 0, r.stderr);
  const trailer = r.stdout.match(/^Claude-Session: (.*)$/m)[1];
  commit(dir, 'verdict', trailer);
  const gate = spawnSync(process.execPath, [GATE, 'verdict'], {
    cwd: dir, encoding: 'utf8',
    env: childEnv({ add: { BASE_SHA: base, HEAD_SHA: git('rev-parse', 'HEAD'), PR_BRANCH: 'build/toy', PR_BODY: 'Item: toy\n', PR_LABELS: '[]' } })
  });
  assert.equal(gate.status, 1, gate.stdout + gate.stderr);
  assert.doesNotMatch(gate.stderr, /same Claude-Session/, 'the refusal is for the empty results, not the session');
  assert.doesNotMatch(gate.stderr, /is not a commit here/, 'the sha is a real commit');
  for (const id of ['seen', 'tested', 'mutated']) assert.match(gate.stderr, new RegExp(id), `the gate names ${id}`);
});

// Runs pr-gate.mjs against a throwaway git repo, the way verdict.yml runs it against a PR.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const gate = join(dirname(fileURLToPath(import.meta.url)), '..', 'pr-gate.mjs');
const itemFile = (expect, status = 'ready') =>
  `\`\`\`json\n${JSON.stringify({ id: 'x', status, expect })}\n\`\`\`\n\n## Verifier brief\n\nRun it.\n`;
const expect = [{ id: 'a', proof: 'world' }];
const verdict = (sha) => JSON.stringify({
  item: 'x', verified_sha: sha, results: [{ id: 'a', status: 'MET', command: 'gh pr checks', excerpt: 'red' }],
});

function repo(first = expect) {
  const dir = mkdtempSync(join(tmpdir(), 'gate-'));
  const git = (...a) => execFileSync('git', a, { cwd: dir, encoding: 'utf8' }).trim();
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  const write = (path, text) => { mkdirSync(join(dir, dirname(path)), { recursive: true }); writeFileSync(join(dir, path), text); };
  const commit = (files, session) => {
    for (const [p, t] of Object.entries(files)) write(p, t);
    git('add', '-A');
    git('commit', '-q', '-m', session ? `change\n\nClaude-Session: ${session}` : 'change');
    return git('rev-parse', 'HEAD');
  };
  const base = commit({ 'plan/items/x.md': itemFile(first) });
  const run = (which, env = {}) => spawnSync('node', [gate, which], {
    cwd: dir, encoding: 'utf8',
    env: { ...process.env, BASE_SHA: base, HEAD_SHA: git('rev-parse', 'HEAD'), PR_BRANCH: 'build/x', PR_BODY: 'Item: x\n', PR_LABELS: '[]', ...env },
  });
  return { commit, run, git, dir };
}

test('verdict gate: none, then from the builder session, then from a separate session', () => {
  const r = repo();
  const built = r.commit({ 'packages/a/index.js': 'export const a = 1;\n' }, 'builder');
  let out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /no verify\/x\/verdict.json/);

  r.commit({ 'verify/x/verdict.json': verdict(built) }, 'builder');
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /same Claude-Session as builder commit/);

  r.commit({ 'verify/x/verdict.json': verdict(built) + '\n' }, 'verifier');
  out = r.run('verdict');
  assert.equal(out.status, 0, out.stderr);

  r.commit({ 'packages/a/index.js': 'export const a = 2;\n' }, 'builder');
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /after the verified sha/);
});

test('verdict gate: a PR with no Item line passes only if it touches plan/ alone, whatever its branch', () => {
  const r = repo();
  r.commit({ 'plan/decisions/d.md': 'chosen\n' });
  assert.equal(r.run('verdict', { PR_BRANCH: 'replan/x', PR_BODY: '' }).status, 0);
  r.commit({ 'docs/d.md': 'notes\n' });
  const out = r.run('verdict', { PR_BRANCH: 'build/x', PR_BODY: '' });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /names no item/);
});

test('freeze gate: softening an Expect line of the named item is red unless a plan-only replan', () => {
  const r = repo();
  r.commit({ 'plan/items/x.md': itemFile([{ id: 'a', proof: 'builder' }], 'doing') });
  let out = r.run('freeze');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /changes the contract of x/);
  assert.equal(r.run('freeze', { PR_LABELS: '["replan"]' }).status, 0);
  r.commit({ 'packages/a/index.js': 'export const a = 1;\n' });
  assert.equal(r.run('freeze', { PR_LABELS: '["replan"]' }).status, 1);
});

test('freeze gate: a status-only change passes', () => {
  const r = repo();
  r.commit({ 'plan/items/x.md': itemFile(expect, 'done') });
  assert.equal(r.run('freeze').status, 0);
});

test('verdict gate: runs the test a verifier line names at the head, and refuses it failing, throwing or missing', () => {
  const r = repo([{ id: 'a', proof: 'world' }, { id: 'v', proof: 'verifier' }]);
  const built = r.commit({ 'packages/a/index.js': 'export const a = 1;\n' }, 'builder');
  const named = (test, extra = {}) => JSON.stringify({ item: 'x', verified_sha: built, observations: ['judged, not run'], results: [
    { id: 'a', status: 'MET', command: 'gh pr checks', excerpt: 'green' },
    { id: 'v', status: 'MET', command: 'node --test', excerpt: 'pass 1', ...(test ? { test } : {}), ...extra }] });
  const testFile = (body) => `import { test } from 'node:test';\nimport assert from 'node:assert/strict';\n${body}\n`;

  r.commit({ 'verify/x/v.test.mjs': testFile("test('holds', () => assert.equal(1, 1));"), 'verify/x/verdict.json': named('verify/x/v.test.mjs') }, 'verifier');
  let out = r.run('verdict');
  assert.equal(out.status, 0, out.stderr);

  r.commit({ 'verify/x/verdict.json': named(null) }, 'verifier');
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /Expect v is verifier-proven, so it names the test that proves it: test is missing/);

  r.commit({ 'verify/x/verdict.json': named('verify/x/v.test.mjs', { test_name: 'nothing matches' }) }, 'verifier');
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /Expect v: test verify\/x\/v.test.mjs \(nothing matches\) ran no test that passed/);

  r.commit({ 'verify/x/v.test.mjs': testFile("test('holds', () => assert.equal(1, 2));"), 'verify/x/verdict.json': named('verify/x/v.test.mjs') }, 'verifier');
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /Expect v: test verify\/x\/v.test.mjs fails at the head/);

  r.commit({ 'verify/x/v.test.mjs': "throw new Error('no fixture');\n" }, 'verifier');
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /Expect v: test verify\/x\/v.test.mjs fails at the head/);

  r.commit({ 'verify/x/verdict.json': named('verify/x/gone.test.mjs') }, 'verifier');
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /verify\/x\/gone.test.mjs does not exist at the head/);
});

test('freeze gate: once the item has a verdict file, even a plan-only replan may not change its contract', () => {
  const r = repo();
  r.commit({ 'verify/x/verdict.json': verdict('0000000') });
  const out = r.run('freeze', { PR_LABELS: '["replan"]' });
  assert.equal(out.status, 0, out.stderr);
  const r2 = repo();
  r2.commit({ 'verify/x/verdict.json': verdict('0000000') });
  r2.commit({ 'plan/items/x.md': itemFile([{ id: 'a', proof: 'builder' }], 'doing') });
  const refused = r2.run('freeze', { PR_LABELS: '["replan"]', BASE_SHA: r2.git('rev-parse', 'HEAD~1'), PR_BRANCH: 'replan/x-change' });
  assert.equal(refused.status, 1);
  assert.match(refused.stderr, /changes the contract of x .*verify\/x\/verdict.json exists/);
});

test('stubs gate: a history comment in engine source is red, naming the file, line and rule; the same line in plan/ is not', () => {
  const r = repo();
  r.commit({ 'plan/items/note.md': '// (plan item fix-x)\n', 'packages/engine/src/a.js': 'export const a = 1;\n' });
  assert.equal(r.run('stubs').status, 0);
  r.commit({ 'packages/engine/src/a.js': 'export const a = 1;\n// (plan item fix-x)\n' });
  const out = r.run('stubs');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /packages\/engine\/src\/a.js:2 has a history reference/);
});

test('stubs gate: one TODO under packages/ is red', () => {
  const r = repo();
  r.commit({ 'packages/a/index.js': 'export const a = 1;\n' });
  assert.equal(r.run('stubs').status, 0);
  r.commit({ 'packages/a/index.js': 'export const a = 1; // TODO\n' });
  const out = r.run('stubs');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /packages\/a\/index.js:1 has TODO/);
});

test('evidence gate: refuses an added or grown file over the limit and a .pass file, never reads a deletion', () => {
  const big = 'x'.repeat(65537);
  const r = repo();
  const base = r.commit({ 'verify/x/old.pass': 'ok 1\n', 'verify/x/old.json': big, 'verify/x/notes.md': 'small\n' });
  const env = { BASE_SHA: base };
  assert.equal(r.run('evidence', env).status, 0);

  r.commit({ 'verify/x/evidence/a.md': 'y'.repeat(65536), 'docs/big.json': big });
  r.git('rm', '-q', 'verify/x/old.pass', 'verify/x/old.json');
  r.git('commit', '-q', '-m', 'drop old evidence');
  let out = r.run('evidence', env);
  assert.equal(out.status, 0, out.stderr);

  r.commit({ 'verify/x/notes.md': big, 'verify/x/listing.pass': 'ok 1\n' });
  out = r.run('evidence', env);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /verify\/x\/notes\.md is 65537 bytes/);
  assert.match(out.stderr, /verify\/x\/listing\.pass is a test listing/);
});

test('evidence gate: refuses a committed symlink and a listing saved as .txt under verify/; passes a short excerpt', () => {
  const r = repo();
  const env = { BASE_SHA: r.git('rev-parse', 'HEAD') };
  const tap = (n) => [...Array.from({ length: n }, (_, i) => `ok ${i + 1} - t${i}`), `# pass ${n}`, '# fail 0'].join('\n');
  r.commit({ 'docs/big.json': 'x'.repeat(65537), 'verify/x/evidence/a.md': `node --test a.test.mjs\n${tap(3)}\n` });
  assert.equal(r.run('evidence', env).status, 0);

  r.git('rm', '-q', 'verify/x/evidence/a.md');
  r.git('commit', '-q', '-m', 'drop');
  mkdirSync(join(r.dir, 'verify/x/evidence'), { recursive: true });
  symlinkSync('../../../docs/big.json', join(r.dir, 'verify/x/evidence/a.md'));
  r.commit({ 'verify/x/listing.txt': `${tap(10)}\n` });
  const out = r.run('evidence', env);
  assert.equal(out.status, 1);
  assert.match(out.stderr, /verify\/x\/evidence\/a\.md is a symlink/);
  assert.match(out.stderr, /verify\/x\/listing\.txt is a test listing/);
});

test('verdict gate: a contract reworded on main and merged in after the verified sha is refused; a status-only merge passes', () => {
  for (const [side, field] of [[itemFile([{ id: 'a', proof: 'world', check: 'reworded' }]), /contract of x moved after the verified sha \w{7} \(expect\)/],
    [itemFile(expect).replace('Run it.', 'Skim it.'), /\(Verifier brief\)/], [itemFile(expect, 'done'), null]]) {
    const r = repo();
    const built = r.commit({ 'packages/a/index.js': 'export const a = 1;\n' }, 'builder');
    r.commit({ 'verify/x/verdict.json': verdict(built) }, 'verifier');
    r.git('checkout', '-q', '-b', 'main-later', r.git('rev-list', '--max-parents=0', 'HEAD'));
    const tip = r.commit({ 'plan/items/x.md': side, 'plan/decisions/d.md': 'chosen\n' });
    r.git('checkout', '-q', '-');
    r.git('merge', '-q', '--no-edit', '-m', 'merge main', 'main-later');
    const out = r.run('verdict', { BASE_SHA: tip });
    if (field) { assert.equal(out.status, 1); assert.match(out.stderr, field); }
    else assert.equal(out.status, 0, out.stderr);
  }
});

test('verdict gate: a verdict whose verified sha has no item file is refused', () => {
  const r = repo();
  const root = r.git('rev-parse', 'HEAD');
  const empty = r.git('hash-object', '-t', 'tree', '-w', '--stdin');
  const lonely = r.git('commit-tree', empty, '-m', 'before the item');
  r.git('merge', '-q', '--allow-unrelated-histories', '--no-edit', '-m', 'take it', lonely);
  r.commit({ 'verify/x/verdict.json': verdict(lonely) }, 'verifier');
  const out = r.run('verdict', { BASE_SHA: root });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /plan\/items\/x.md does not exist at the verified sha/);
});

test('freeze gate: a set done_on moves only by a plan-only replan that says why', () => {
  const dated = (date, why = '') => `\`\`\`json\n${JSON.stringify({ id: 'x', status: 'done', done_on: date, expect })}\n\`\`\`\n\n## Verifier brief\n\nRun it.\n${why}`;
  const r = repo();
  const base = r.commit({ 'plan/items/x.md': dated('2026-11-01') });
  r.commit({ 'plan/items/x.md': dated('2026-11-08') });
  const env = { BASE_SHA: base, PR_BODY: '' };
  let out = r.run('freeze', { ...env, PR_LABELS: '["replan"]' });
  assert.equal(out.status, 1);
  assert.match(out.stderr, /changes done_on of x from 2026-11-01 to 2026-11-08/);
  r.commit({ 'plan/items/x.md': dated('2026-11-08', '\n## Done on change\n\nThe merge date, not the build date.\n') });
  assert.equal(r.run('freeze', { ...env, PR_LABELS: '["replan"]' }).status, 0);
  assert.equal(r.run('freeze', { ...env, PR_LABELS: '[]' }).status, 1);
});

test('a build PR whose first commit sets its item done passes freeze, and merges on a verdict from another session', () => {
  const r = repo();
  const done = `\`\`\`json\n${JSON.stringify({ id: 'x', status: 'done', done_on: '2026-11-08', expect })}\n\`\`\`\n\n## Verifier brief\n\nRun it.\n`;
  r.commit({ 'plan/items/x.md': done }, 'builder');
  const built = r.commit({ 'packages/a/index.js': 'export const a = 1;\n' }, 'builder');
  let out = r.run('freeze');
  assert.equal(out.status, 0, out.stderr);
  out = r.run('verdict');
  assert.equal(out.status, 1);
  assert.match(out.stderr, /no verify\/x\/verdict.json/);
  r.commit({ 'verify/x/verdict.json': verdict(built) }, 'verifier');
  out = r.run('verdict');
  assert.equal(out.status, 0, out.stderr);
});

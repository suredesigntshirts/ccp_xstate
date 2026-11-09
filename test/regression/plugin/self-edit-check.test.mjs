// Expect: self-edit-check-snapshot/env-inherited, self-edit-check-snapshot/runs-without-strace, self-edit-check-snapshot/snapshot-detects, self-edit-check-snapshot/strace-kept, self-edit-check-snapshot/tags-dropped, self-edit-check-snapshot/temp-removed, self-edit-check-snapshot/tests-bite
// The no-self-edit check and test/setup.test.mjs, run as child suites: every command they spawn gets the test's
// environment; they run without strace, in clones with or without release refs, and leave nothing in TMPDIR; their
// snapshot reports every kind of write; each no-self-edit test goes red when the path it guards writes. The tracer
// prints a command's writes under a folder and says when strace is missing.
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { leanClone } from '../lib.mjs';

// Helpers for the tests below.
const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(join(HERE, '..', '..', '..'));
const NO_SELF_EDIT = 'test/regression/plugin/no-self-edit.test.mjs';
const SETUP_TEST = 'test/setup.test.mjs';

/** A temp folder removed when the test `t` ends. */
function temp(t, name) {
  const d = realpathSync(mkdtempSync(join(tmpdir(), `secs-${name}-`)));
  t.after(() => rmSync(d, { recursive: true, force: true }));
  return d;
}

/** Git with no global config, so the container's commit signing and identity stay out. */
function git(cwd, ...args) {
  return execFileSync('git', ['-C', cwd, '-c', 'user.email=v@v', '-c', 'user.name=v', '-c', 'commit.gpgsign=false', '-c', 'tag.gpgsign=false', ...args],
    { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
}

/** A clone of the checkout's HEAD at <dir>/repo. */
function cloneHead(dir) {
  const c = join(dir, 'repo');
  leanClone(REPO, c, { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
  return c;
}

/** Commit every change in a clone (so the tests' own clones of it see the change). */
const commitAll = (c, msg) => { git(c, 'add', '-A'); git(c, 'commit', '-q', '-m', msg); };

/** node --test on one file in `cwd`, with `env` (defaults to this process's) and extra args; the summary parsed. */
function nodeTest(cwd, file, { env = process.env, args = [] } = {}) {
  // A node --test inside a test file runs nothing unless the parent's test context is dropped.
  const { NODE_TEST_CONTEXT, ...clean } = env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', ...args, file], { cwd, env: clean, encoding: 'utf8', timeout: 540000 });
  const n = (k) => Number((r.stdout.match(new RegExp(`^# ${k} (\\d+)$`, 'm')) ?? [])[1] ?? NaN);
  return { status: r.status, out: r.stdout + r.stderr, tests: n('tests'), pass: n('pass'), fail: n('fail'), skipped: n('skipped') };
}

/** The names of the failing tests in a TAP run. */
const failing = (out) => [...out.matchAll(/^not ok \d+ - (.*)$/gm)].map((m) => m[1]);

/** A folder of links to every command on PATH except those named in `drop`, first found wins. */
function pathWithout(dir, drop) {
  for (const d of (process.env.PATH ?? '').split(':').filter(Boolean)) {
    if (!existsSync(d)) continue;
    for (const n of readdirSync(d)) {
      if (drop.includes(n) || existsSync(join(dir, n))) continue;
      try { symlinkSync(join(d, n), join(dir, n)); } catch { /* a name seen twice */ }
    }
  }
  return dir;
}

/** True when `cmd` resolves on PATH `p`. */
const onPath = (cmd, p) => spawnSync('bash', ['-c', `command -v ${cmd}`], { env: { ...process.env, PATH: p } }).status === 0;

{
const ALLOWED = /^(CCP_SETUP_LOG|CCP_SETUP_SKILLS|CLAUDE_PID|CCP_HARNESS_\w+|CLAUDE_PLUGIN_ROOT|CCP_REPO)$/;
const PROXY_MARK = 'http://secs-proxy.invalid:9';
const BASH = '/bin/bash';

test('env-inherited: setup.sh, the hook and release.mjs get the test environment, HOME the temp home, no foreign CLAUDE*/CCP*', (t) => {
  const d = temp(t, 'env');
  const bin = join(d, 'bin'), seen = join(d, 'seen');
  mkdirSync(bin);
  mkdirSync(seen);
  // Where no real proxy is set (CI), a marker is recorded, then dropped before the real bash runs, so npm ci is not
  // sent to a host that does not exist.
  const proxy = process.env.HTTPS_PROXY || PROXY_MARK;
  const ca = process.env.NODE_EXTRA_CA_CERTS || '/etc/ssl/certs/ca-certificates.crt';
  writeFileSync(join(bin, 'bash'), `#!${BASH}
env -0 > "${seen}/bash-$$-$RANDOM"
if [ "$HTTPS_PROXY" = "${PROXY_MARK}" ]; then exec env -u HTTPS_PROXY ${BASH} "$@"; fi
exec ${BASH} "$@"
`);
  chmodSync(join(bin, 'bash'), 0o755);
  writeFileSync(join(d, 'preload.cjs'), `const s = process.argv[1] || '';
if (/notice-behind\\.mjs$|release\\.mjs$/.test(s)) {
  require('fs').writeFileSync(${JSON.stringify(seen)} + '/node-' + process.pid,
    Object.entries(process.env).map(([k, v]) => k + '=' + v).join('\\0') + '\\0ARGV1=' + s);
}
`);
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    NODE_EXTRA_CA_CERTS: ca,
    HTTPS_PROXY: proxy,
    CLAUDE_SECS_X: 'from-the-thread',
    CCP_SECS_Y: 'from-the-thread',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${join(d, 'preload.cjs')}`.trim(),
  };
  const r = nodeTest(REPO, NO_SELF_EDIT, { env });
  assert.equal(r.fail, 0, r.out.slice(-3000));
  assert.equal(r.pass, 6);

  const runs = readdirSync(seen).map((f) => ({
    f,
    vars: Object.fromEntries(readFileSync(join(seen, f), 'utf8').split('\0').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])),
  }));
  const setups = runs.filter((x) => x.f.startsWith('bash-'));
  const hooks = runs.filter((x) => /notice-behind\.mjs$/.test(x.vars.ARGV1 ?? ''));
  const releases = runs.filter((x) => /release\.mjs$/.test(x.vars.ARGV1 ?? ''));
  t.diagnostic(`bash runs ${setups.length}, hook runs ${hooks.length}, release.mjs runs ${releases.length}`);
  assert.ok(setups.length >= 8, `setup.sh ran under the stub (${setups.length} runs)`);
  assert.ok(hooks.length >= 1 && releases.length >= 2, 'the hook and both release.mjs runs were seen');
  for (const { f, vars } of runs) {
    assert.match(vars.HOME ?? '', /\/verify-noself-world-[^/]+\/home$/, `${f}: HOME is the test's temp home`);
    assert.equal(vars.NODE_EXTRA_CA_CERTS, ca, `${f}: NODE_EXTRA_CA_CERTS inherited`);
    assert.equal(vars.HTTPS_PROXY, proxy, `${f}: HTTPS_PROXY inherited`);
    assert.equal(vars.CLAUDE_SECS_X, undefined, `${f}: the thread's CLAUDE_* removed`);
    assert.equal(vars.CCP_SECS_Y, undefined, `${f}: the thread's CCP_* removed`);
    assert.deepEqual(Object.keys(vars).filter((k) => /^(CLAUDE|CCP)/.test(k) && !ALLOWED.test(k)), [], `${f}: only the test's own CLAUDE*/CCP* names`);
    assert.equal(vars.PATH?.split(':')[0], bin, `${f}: PATH inherited`);
  }
});
}

{
const TOOL = 'str' + 'ace';

function testFiles(dir) {
  const out = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git') continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...testFiles(p));
    else if (/\.(m|c)?js$/.test(e.name)) out.push(p);
  }
  return out;
}

test('runs-without-strace: with no strace on PATH all six no-self-edit tests run and pass', (t) => {
  const bin = pathWithout(temp(t, 'bin'), [TOOL]);
  assert.equal(onPath(TOOL, bin), false, 'the tool is not on the PATH the run gets');
  assert.equal(onPath('node', bin) && onPath('git', bin) && onPath('bash', bin), true);
  const r = nodeTest(REPO, NO_SELF_EDIT, { env: { ...process.env, PATH: bin } });
  t.diagnostic(`tests ${r.tests} pass ${r.pass} fail ${r.fail} skipped ${r.skipped}`);
  assert.deepEqual({ tests: r.tests, pass: r.pass, fail: r.fail, skipped: r.skipped }, { tests: 6, pass: 6, fail: 0, skipped: 0 }, r.out.slice(-3000));
});
}

{
/** The two exported functions of the no-self-edit file, as a module of their own. */
async function detector(dir) {
  const src = readFileSync(join(REPO, NO_SELF_EDIT), 'utf8');
  const fn = (name) => {
    const m = src.match(new RegExp(`^export function ${name}\\([\\s\\S]*?^}$`, 'm'));
    assert.ok(m, `${name} found in ${NO_SELF_EDIT}`);
    return m[0];
  };
  const mod = join(dir, 'detector.mjs');
  writeFileSync(mod, `import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
${fn('snap')}
${fn('changed')}
`);
  return import(pathToFileURL(mod).href);
}

/** A folder with files, a subfolder and a link, at <dir>/w. */
function world(dir) {
  const w = join(dir, 'w');
  mkdirSync(join(w, 'sub'), { recursive: true });
  writeFileSync(join(w, 'a.txt'), 'alpha\n');
  writeFileSync(join(w, 'sub', 'b.txt'), 'bravo\n');
  writeFileSync(join(w, 'c.txt'), 'charlie\n');
  writeFileSync(join(w, 't1'), '1');
  writeFileSync(join(w, 't2'), '2');
  symlinkSync('t1', join(w, 'link'));
  return w;
}

// Timestamps move in clock ticks; a short wait keeps each mutation from landing in the tick the snapshot saw.
const tick = () => new Promise((r) => setTimeout(r, 25));

const MUTATIONS = [
  ['a file created', (w) => writeFileSync(join(w, 'sub', 'new.txt'), 'x'), (w) => join(w, 'sub', 'new.txt')],
  ['a file deleted', (w) => unlinkSync(join(w, 'c.txt')), (w) => join(w, 'c.txt')],
  ['a file\'s content edited', (w) => writeFileSync(join(w, 'a.txt'), 'ALPHA\n'), (w) => join(w, 'a.txt')],
  ['a file rewritten with its old content', (w) => writeFileSync(join(w, 'sub', 'b.txt'), readFileSync(join(w, 'sub', 'b.txt'))), (w) => join(w, 'sub', 'b.txt')],
  ['a mode change', (w) => chmodSync(join(w, 'a.txt'), 0o600), (w) => join(w, 'a.txt')],
  ['an empty folder made', (w) => mkdirSync(join(w, 'sub', 'empty')), (w) => join(w, 'sub', 'empty')],
  ['a symlink retargeted', (w) => { unlinkSync(join(w, 'link')); symlinkSync('t2', join(w, 'link')); }, (w) => join(w, 'link')],
  ['an identical copy moved over a file', (w) => { copyFileSync(join(w, 'c.txt'), join(w, 'c.tmp')); renameSync(join(w, 'c.tmp'), join(w, 'c.txt')); }, (w) => join(w, 'c.txt')],
];

for (const [name, mutate, entry] of MUTATIONS) {
  test(`snapshot-detects: ${name} is reported, naming the entry`, async (t) => {
    const d = temp(t, 'snap');
    const { snap, changed } = await detector(d);
    const w = world(d);
    const before = snap(w);
    await tick();
    mutate(w);
    const diff = changed(before, snap(w));
    t.diagnostic(`${name}: ${JSON.stringify(diff.map((p) => p.slice(w.length)))}`);
    assert.ok(diff.includes(entry(w)), `${entry(w)} named in ${JSON.stringify(diff)}`);
  });
}

test('snapshot-detects: an identical rewrite reported even with no wait before it', async (t) => {
  const d = temp(t, 'snap');
  const { snap, changed } = await detector(d);
  const w = world(d);
  const before = snap(w);
  writeFileSync(join(w, 'a.txt'), 'alpha\n');
  copyFileSync(join(w, 'c.txt'), join(w, 'c.tmp'));
  renameSync(join(w, 'c.tmp'), join(w, 'c.txt'));
  const diff = changed(before, snap(w));
  assert.ok(diff.includes(join(w, 'c.txt')), 'the moved copy (new inode) is seen at once');
});

test('snapshot-detects: a run that only reads the folder reports nothing', async (t) => {
  const d = temp(t, 'snap');
  const { snap, changed } = await detector(d);
  const w = world(d);
  const before = snap(w);
  await tick();
  const walk = (p) => { for (const n of readdirSync(p, { withFileTypes: true })) { const q = join(p, n.name); statSync(q); if (n.isDirectory()) walk(q); else if (n.isFile()) readFileSync(q); } };
  walk(w);
  snap(w);
  assert.deepEqual(changed(before, snap(w)), []);
});

test('snapshot-detects: the root itself is in the snapshot, and deleting a whole folder names its entries', async (t) => {
  const d = temp(t, 'snap');
  const { snap, changed } = await detector(d);
  const w = world(d);
  const before = snap(w);
  assert.ok(w in before, 'the watched folder is an entry');
  await tick();
  rmSync(join(w, 'sub'), { recursive: true });
  const diff = changed(before, snap(w));
  assert.ok(diff.includes(join(w, 'sub')) && diff.includes(join(w, 'sub', 'b.txt')) && diff.includes(w));
});
}

{
const SCRIPT = join(REPO, 'scripts', 'debug', 'trace-writes.mjs');
const TOOL = 'str' + 'ace';
const hasTool = spawnSync(TOOL, ['-V']).status === 0;

function world(t) {
  const d = temp(t, 'trace');
  const f = join(d, 'watched'), out = join(d, 'outside'), tmp = join(d, 'tmp');
  for (const p of [join(f, 'sub'), out, tmp]) mkdirSync(p, { recursive: true });
  // Absolute, relative after cd, relative from a node grandchild after chdir, and one write outside the folder.
  const cmd = ['bash', '-c', [
    `echo a > ${f}/abs.txt`,
    `echo o > ${out}/not-me.txt`,
    `(cd ${f}/sub && echo b > rel.txt && mkdir made)`,
    `${process.execPath} -e "process.chdir('${f}'); require('fs').writeFileSync('n.txt', 'x')"`,
    'exit 3',
  ].join('; ')];
  return { d, f, out, tmp, cmd };
}
const run = (w, args, env = {}) => spawnSync(process.execPath, [SCRIPT, ...args], { cwd: w.d, encoding: 'utf8', env: { ...process.env, TMPDIR: w.tmp, ...env } });

test('strace-kept: writes by the command and its children under the folder are printed, relative ones too', { skip: !hasTool && `${TOOL} missing` }, (t) => {
  const w = world(t);
  const r = run(w, [w.f, '--', ...w.cmd]);
  t.diagnostic(r.stdout.trim().replace(/\n/g, ' | '));
  for (const p of [`${w.f}/abs.txt`, `${w.f}/sub/rel.txt`, `${w.f}/sub/made`, `${w.f}/n.txt`]) {
    assert.match(r.stdout, new RegExp(`^\\d+ \\w+ ${p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'm'), `${p} printed`);
  }
  assert.doesNotMatch(r.stdout, /not-me\.txt/, 'a write outside the folder is not printed');
  const pids = new Set(r.stdout.trim().split('\n').map((l) => l.split(' ')[0]));
  assert.ok(pids.size >= 3, 'writes from more than one process (children followed)');
  assert.equal(r.status, 3, 'exits with the command\'s status');
  assert.deepEqual(readdirSync(w.tmp), [], 'no trace file left');
});

test('strace-kept: --keep puts the trace where it says, and nothing else is left', { skip: !hasTool && `${TOOL} missing` }, (t) => {
  const w = world(t);
  const kept = join(w.out, 'kept.trace');
  const r = run(w, [w.f, '--keep', kept, '--', 'bash', '-c', `echo a > ${w.f}/abs.txt`]);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(kept));
  assert.match(readFileSync(kept, 'utf8'), /abs\.txt/);
  assert.deepEqual(readdirSync(w.tmp), []);
});

test('strace-kept: with strace off PATH it says strace is needed and runs nothing', (t) => {
  const w = world(t);
  const bin = pathWithout(temp(t, 'bin'), [TOOL]);
  const r = run(w, [w.f, '--', 'bash', '-c', `echo a > ${w.f}/abs.txt`], { PATH: bin });
  assert.equal(r.status, 127);
  assert.match(r.stderr, new RegExp(`needs ${TOOL}`));
  assert.ok(!existsSync(join(w.f, 'abs.txt')), 'the command did not run untraced');
});
}

{
const releaseRefs = (c) => git(c, 'for-each-ref', '--format=%(refname)', 'refs/tags/harness-v*', 'refs/heads/release/', 'refs/remotes/origin/release/').split('\n').filter(Boolean);

function clone(t) {
  const c = cloneHead(temp(t, 'tags'));
  symlinkSync(join(REPO, 'node_modules'), join(c, 'node_modules'));
  for (const ref of releaseRefs(c)) git(c, 'update-ref', '-d', ref);
  return c;
}

/** A release branch newer than every tag, at a commit of its own (a shallow checkout has no HEAD~1). */
function newerBranch(c) {
  const side = git(c, 'commit-tree', 'HEAD^{tree}', '-p', 'HEAD', '-m', 'a later release');
  git(c, 'branch', 'release/harness-v3.0.0', side);
}

test('tags-dropped: setup.test.mjs passes in a clone with newer harness-v tags and a newer release branch', (t) => {
  const c = clone(t);
  for (const tag of ['harness-v0.1.11', 'harness-v0.1.40', 'harness-v2.0.0']) git(c, 'tag', tag, 'HEAD');
  newerBranch(c);
  t.diagnostic(`release refs: ${releaseRefs(c).join(' ')}`);
  const r = nodeTest(c, SETUP_TEST);
  assert.deepEqual({ fail: r.fail, skipped: r.skipped }, { fail: 0, skipped: 0 }, r.out.slice(-3000));
  assert.ok(r.pass >= 6);
});

test('tags-dropped: setup.test.mjs passes in a clone with no release refs', (t) => {
  const c = clone(t);
  assert.deepEqual(releaseRefs(c), []);
  const r = nodeTest(c, SETUP_TEST);
  assert.deepEqual({ fail: r.fail, skipped: r.skipped }, { fail: 0, skipped: 0 }, r.out.slice(-3000));
  assert.ok(r.pass >= 6);
});

test('tags-dropped: the same tagged clone with the copy-not-link test without its drop of inherited release refs goes red', (t) => {
  const c = clone(t);
  for (const tag of ['harness-v0.1.11', 'harness-v0.1.40', 'harness-v2.0.0']) git(c, 'tag', tag, 'HEAD');
  newerBranch(c);
  // The test without the drop: the head's file less the lines that drop inherited release refs.
  const p = join(c, SETUP_TEST), src = readFileSync(p, 'utf8');
  const prior = src.split('\n').filter((l) => !/\binherited\b/.test(l)).join('\n');
  assert.equal(src.split('\n').length - prior.split('\n').length, 2, 'the two drop lines removed');
  writeFileSync(p, prior);
  const r = nodeTest(c, SETUP_TEST, { args: ['--test-name-pattern=copy-not-link: with release tags'] });
  t.diagnostic(`without the drop: fail ${r.fail}`);
  assert.equal(r.fail, 1, 'without the drop the inherited newer releases win');
});
}

{
function run(t, cwd, file, args = []) {
  const tmp = join(temp(t, 'tmpdir'), 'tmp');
  mkdirSync(join(tmp, 'node-compile-cache'), { recursive: true });
  const before = readdirSync(tmp);
  const r = nodeTest(cwd, file, { env: { ...process.env, TMPDIR: tmp }, args });
  const left = readdirSync(tmp).filter((n) => !before.includes(n));
  t.diagnostic(`${file}: pass ${r.pass} fail ${r.fail}; left in TMPDIR: ${JSON.stringify(left)}`);
  return { r, left };
}

/** A clone of the head with one assertion in `file` changed to fail. */
function broken(t, file, from, to) {
  const c = cloneHead(temp(t, 'broken'));
  symlinkSync(join(REPO, 'node_modules'), join(c, 'node_modules'));
  const p = join(c, file), src = readFileSync(p, 'utf8');
  assert.ok(src.includes(from), `${from} in ${file}`);
  writeFileSync(p, src.replace(from, to));
  commitAll(c, 'make one assertion fail');
  return c;
}

test('temp-removed: no-self-edit.test.mjs, passing, leaves nothing in the temp folder', (t) => {
  const { r, left } = run(t, REPO, NO_SELF_EDIT);
  assert.deepEqual({ pass: r.pass, fail: r.fail }, { pass: 6, fail: 0 }, r.out.slice(-2000));
  assert.deepEqual(left, []);
});

test('temp-removed: no-self-edit.test.mjs, with a test made to fail midway, leaves nothing in the temp folder', (t) => {
  const c = broken(t, NO_SELF_EDIT, "assert.equal(manifestVersion(w.dest), '1.2.3');", "assert.equal(manifestVersion(w.dest), '1.2.4');");
  const { r, left } = run(t, c, NO_SELF_EDIT, ['--test-name-pattern=different HOME|notice hook']);
  assert.deepEqual({ pass: r.pass, fail: r.fail }, { pass: 1, fail: 1 }, r.out.slice(-2000));
  assert.deepEqual(left, []);
});

test('temp-removed: test/setup.test.mjs, passing, leaves nothing in the temp folder', (t) => {
  const { r, left } = run(t, REPO, SETUP_TEST);
  assert.equal(r.fail, 0, r.out.slice(-2000));
  assert.deepEqual(left, []);
});

test('temp-removed: test/setup.test.mjs, with a test made to fail, leaves nothing in the temp folder', (t) => {
  const c = broken(t, SETUP_TEST, "assert.equal(release.tag, 'harness-v0.1.10');", "assert.equal(release.tag, 'harness-v9.9.9');");
  const { r, left } = run(t, c, SETUP_TEST);
  assert.equal(r.fail, 1, r.out.slice(-2000));
  assert.deepEqual(left, []);
});
}

{
const SETUP = 'infra/cloud-environment/setup.sh';
const HOOK = 'plugins/harness/scripts/notice-behind.mjs';
const RELEASE = 'scripts/release/release.mjs';
const NOT_REPLACED = /^(\s*)echo "plugin not replaced: .*"$/m;

/** After the shebang, a line that writes `target` when the script loads. */
const writeOnLoad = (src, target) => src.replace(/^(#!.*\n)/, `$1import { writeFileSync as secsWrite } from 'node:fs'; secsWrite(${target}, 'x');\n`);

const CASES = [
  {
    name: 'setup.sh says it left the plugin alone but replaces it beside a live Claude',
    file: SETUP,
    edit: (s) => s.replace(NOT_REPLACED, (line, ind) => `${line}\n${ind}rm -rf "$dest.old"; mv "$dest" "$dest.old"; mv "$work/out" "$dest"; rm -rf "$dest.old"`),
    pattern: 'live Claude',
    red: ['same HOME writes nothing', 'newest release only a branch'],
    why: /nothing under the plugin root or its \.old changed|deepStrictEqual/,
  },
  {
    name: 'setup.sh only touches plugin.json beside a live Claude (same bytes, new mtime)',
    file: SETUP,
    edit: (s) => s.replace(NOT_REPLACED, (line, ind) => `${line}\n${ind}touch "$dest/.claude-plugin/plugin.json"`),
    pattern: 'live Claude',
    red: ['same HOME writes nothing', 'newest release only a branch'],
    why: /plugin\.json/,
  },
  {
    name: 'the notice hook writes a file beside itself under the plugin root',
    file: HOOK,
    edit: (s) => writeOnLoad(s, `new URL('./written.txt', import.meta.url)`),
    pattern: 'notice hook',
    red: ['notice hook'],
    why: /written\.txt/,
  },
  {
    name: 'release.mjs writes a file at the repo root',
    file: RELEASE,
    edit: (s) => writeOnLoad(s, `process.cwd() + '/written.txt'`),
    pattern: 'release\\.mjs',
    red: ['only writes git objects', 'branch --push writes only git refs'],
    why: /written\.txt/,
  },
];

for (const c of CASES) {
  test(`tests-bite: ${c.name}`, (t) => {
    const repo = cloneHead(temp(t, 'bite'));
    const p = join(repo, c.file), src = readFileSync(p, 'utf8'), broken = c.edit(src);
    assert.notEqual(broken, src, 'the break applied');
    writeFileSync(p, broken);
    commitAll(repo, 'break');
    const r = nodeTest(repo, NO_SELF_EDIT, { args: [`--test-name-pattern=${c.pattern}`] });
    const red = failing(r.out);
    t.diagnostic(`red: ${JSON.stringify(red)}`);
    t.diagnostic(`why: ${(r.out.match(c.why) ?? [''])[0]}`);
    for (const name of c.red) assert.ok(red.some((n) => n.includes(name)), `${name} went red: ${red}`);
    assert.match(r.out, c.why, 'the failure names the changed entry');
  });
}
}

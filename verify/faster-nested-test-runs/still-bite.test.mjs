// Expect: faster-nested-test-runs/still-bite
// Each mutation check that now reruns only named tests still guards them: in a copy of the head, it passes intact,
// fails when the tests it names are made to pass whatever the code does, and fails when one of them is renamed so
// its name pattern matches nothing. The self-edit-check checks that now share one nested run each still go red when
// the run they read is broken in the one way each checks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const PLAN_CHECK = 'test/plan-check.test.mjs', PR_GATE = 'scripts/gates/test/pr-gate.test.mjs';
const CASES = [
  { file: 'test/regression/gates/build-sets-done.test.mjs', bite: 'pr-gate.test.mjs goes red when contract() keeps status', target: PR_GATE,
    names: ['freeze gate: a status-only change passes',
      'verdict gate: a contract reworded on main and merged in after the verified sha is refused; a status-only merge passes',
      'a build PR whose first commit sets its item done passes freeze, and merges on a verdict from another session'] },
  { file: 'test/regression/gates/contract-and-verdict-tests.test.mjs', bite: 'test/plan-check.test.mjs goes red when the deny-list in check.mjs is emptied', target: PLAN_CHECK,
    names: ['a ready Expect check that pins main is refused, naming the item, the Expect id and the phrase'] },
  { file: 'test/regression/gates/evidence-links-listings.test.mjs', bite: 'pr-gate.test.mjs goes red when the evidence gate stops passing the mode from git ls-tree', target: PR_GATE,
    names: ['evidence gate: refuses an added or grown file over the limit and a .pass file, never reads a deletion',
      'evidence gate: refuses a committed symlink and a listing saved as .txt under verify/; passes a short excerpt'] },
  { file: 'test/regression/gates/verdict-cutoff.test.mjs', bite: 'pr-gate.test.mjs goes red when the verdict gate stops reading the item at verified_sha', target: PR_GATE,
    names: ['verdict gate: a contract reworded on main and merged in after the verified sha is refused; a status-only merge passes',
      'verdict gate: a verdict whose verified sha has no item file is refused'] },
  { file: 'test/regression/plan/lean-ready-head.test.mjs', bite: 'plan-check.test.mjs goes red with verifier back in readyRequired', target: PLAN_CHECK,
    names: ['a ready head needs no verifier and no step_back; it still needs expect'] },
  { file: 'test/regression/plan/no-doing-status.test.mjs', bite: 'plan-check.test.mjs goes red with doing back in the schema', target: PLAN_CHECK,
    names: ['doing is no longer a status: an item holding it is refused'] },
  { file: 'test/regression/plan/ready-rules-named.test.mjs', bite: 'plan-check.test.mjs goes red with SHA matching hex letters alone', target: PLAN_CHECK,
    names: ['a sha of seven or more hex digits is refused; a repo path or a word of hex letters alone is not'] },
];

/** A copy of the head's code (no .git, verify/, bench/ or tournaments/), node_modules linked. */
function copyHead(t) {
  const dir = mkdtempSync(join(tmpdir(), 'fntr-bite-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'test', 'packages', 'plugins', 'workflows', 'infra', 'docs', 'package.json', 'CLAUDE.md'])
    if (existsSync(join(REPO, p))) cpSync(join(REPO, p), join(dir, p), { recursive: true, verbatimSymlinks: true });
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return dir;
}
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
/** node --test of one test in `dir`, picked by the start of its name. */
function runBite(dir, c) {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=^${esc(c.bite)}`, c.file], { cwd: dir, env, encoding: 'utf8', timeout: 600000 });
  const n = (k) => Number(r.stdout.match(new RegExp(`^# ${k} (\\d+)$`, 'm'))?.[1] ?? NaN);
  return { status: r.status, pass: n('pass'), fail: n('fail'), out: r.stdout.slice(-3000) + r.stderr.slice(-2000) };
}
/** Rewrite `test('<name>', ...)` in `file` of `dir`: `how(name)` gives the replacement for its head. */
function rewrite(dir, file, names, how) {
  const p = join(dir, file);
  let text = readFileSync(p, 'utf8');
  names.forEach((name, i) => {
    const head = `test('${name.replaceAll("'", "\\'")}', `;
    assert.ok(text.includes(head), `${file} declares ${name}`);
    text = text.replace(head, how(head, i));
  });
  writeFileSync(p, text);
}
// The named test is replaced by one that passes; the original call is kept unregistered inside a function never called.
const hollow = (head, i) => `${head}() => {}); const __hollow${i} = () => test('hollowed', `;
const renamed = (head) => head.replace(/', $/, " (renamed)', ");

for (const c of CASES) {
  test(`${c.file.split('/').pop()}: passes intact, fails with its named tests hollowed, fails with one renamed`, (t) => {
    const dir = copyHead(t);
    const intact = runBite(dir, c);
    assert.equal(intact.status, 0, intact.out);
    assert.equal(intact.pass, 1, `the bite test ran: ${intact.out}`);

    const target = readFileSync(join(dir, c.target), 'utf8');
    rewrite(dir, c.target, c.names, hollow);
    const hollowed = runBite(dir, c);
    writeFileSync(join(dir, c.target), target);
    assert.notEqual(hollowed.status, 0, `with ${c.names.length} named test(s) hollowed the mutation check fails: ${hollowed.out}`);
    assert.equal(hollowed.fail, 1, hollowed.out);

    rewrite(dir, c.target, c.names.slice(0, 1), renamed);
    const gone = runBite(dir, c);
    writeFileSync(join(dir, c.target), target);
    assert.notEqual(gone.status, 0, `with a named test renamed the mutation check fails: ${gone.out}`);
    assert.equal(gone.fail, 1, gone.out);
    t.diagnostic(`intact pass ${intact.pass}; hollowed fail ${hollowed.fail}; renamed fail ${gone.fail}`);
  });
}

// self-edit-check: env-inherited, runs-without-strace and temp-removed read one no-self-edit run; temp-removed's
// passing setup.test run is tags-dropped's. Each break below is committed in a lean clone of the head, since the
// file's own clones read commits.
const SEC = 'test/regression/plugin/self-edit-check.test.mjs';
const NSE = 'test/regression/plugin/no-self-edit.test.mjs';
const LEAK = "\nimport { mkdtempSync as leakTemp } from 'node:fs';\nimport { tmpdir as leakDir } from 'node:os';\nleakTemp(leakDir() + '/secs-leak-');\n";
const SEC_CASES = [
  { name: 'temp-removed (passing no-self-edit) goes red when no-self-edit leaves a temp folder', file: NSE, edit: (s) => s + LEAK,
    pattern: '^temp-removed: no-self-edit\\.test\\.mjs, passing', red: ['temp-removed: no-self-edit.test.mjs, passing, leaves nothing in the temp folder'] },
  { name: 'runs-without-strace goes red when no-self-edit cannot run without strace', file: NSE,
    edit: (s) => s.replace("const made = [];", "if (spawnSync('sh', ['-c', 'command -v str' + 'ace']).status !== 0) throw new Error('needs the tool');\nconst made = [];"),
    pattern: '^runs-without-strace', red: ['runs-without-strace: with no strace on PATH all six no-self-edit tests run and pass'] },
  { name: 'env-inherited goes red when no-self-edit passes the thread\'s CLAUDE*/CCP* variables on', file: NSE,
    edit: (s) => s.replace("filter(([k]) => !/^(CLAUDE|CCP)/.test(k))", 'filter(() => true)'),
    pattern: '^env-inherited', red: ['env-inherited: setup.sh, the hook and release.mjs get the test environment, HOME the temp home, no foreign CLAUDE*/CCP*'] },
  { name: 'temp-removed (passing setup.test) goes red when setup.test.mjs leaves a temp folder, read from tags-dropped\'s run', file: 'test/setup.test.mjs', edit: (s) => s + LEAK,
    pattern: '^tags-dropped: setup\\.test\\.mjs passes in a clone with no release refs|^temp-removed: test/setup\\.test\\.mjs, passing', red: ['temp-removed: test/setup.test.mjs, passing, leaves nothing in the temp folder'] },
];

const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, '-c', 'user.email=v@v', '-c', 'user.name=v', '-c', 'commit.gpgsign=false', ...a],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
const { leanClone } = await import(join(REPO, 'test/regression/lib.mjs'));

function cloneHead(t) {
  const parent = mkdtempSync(join(tmpdir(), 'fntr-sec-'));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const c = join(parent, 'repo');
  leanClone(REPO, c, { env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } });
  symlinkSync(join(REPO, 'node_modules'), join(c, 'node_modules'));
  writeFileSync(join(c, '.git', 'info', 'exclude'), 'node_modules\n', { flag: 'a' });
  return c;
}
function runSec(c, pattern) {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${pattern}`, SEC], { cwd: c, env, encoding: 'utf8', timeout: 900000 });
  const failing = [...r.stdout.matchAll(/^\s*not ok \d+ - (.*)$/gm)].map((m) => m[1]);
  const passing = [...r.stdout.matchAll(/^\s*ok \d+ - (.*)$/gm)].map((m) => m[1]);
  return { status: r.status, failing, passing, out: r.stdout.slice(-3000) + r.stderr.slice(-1500) };
}

for (const s of SEC_CASES) {
  test(`self-edit-check: ${s.name}`, (t) => {
    const c = cloneHead(t);
    const intact = runSec(c, s.pattern);
    assert.equal(intact.status, 0, intact.out);
    for (const n of s.red) assert.ok(intact.passing.includes(n), `${n} passes intact: ${intact.out}`);
    const p = join(c, s.file), src = readFileSync(p, 'utf8'), changed = s.edit(src);
    assert.notEqual(changed, src, `the break applies to ${s.file}`);
    writeFileSync(p, changed);
    git(c, 'commit', '-qam', 'break');
    const broken = runSec(c, s.pattern);
    for (const n of s.red) assert.ok(broken.failing.includes(n), `${n} goes red: ${broken.out}`);
    t.diagnostic(`intact pass ${intact.passing.length}; broken red: ${broken.failing.join(' | ')}`);
  });
}

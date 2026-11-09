// Records the runs that same-tests, no-leak and faster read: each changed test file run alone with the TAP reporter
// in a base and a head clone, alternating, for three rounds; around each run the clone's git status, branch list,
// worktree list and the clone's parent folder are snapshotted. The summary goes to <out>/summary.json and each TAP
// output to <out>/tap/. Usage: node record.mjs <baseClone> <headClone> <out> [rounds]
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { FILES } from './lib.mjs';

const [base, head, out, roundsArg] = process.argv.slice(2);
const ROUNDS = Number(roundsArg ?? 3);
mkdirSync(join(out, 'tap'), { recursive: true });
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();

const snapshot = (repo) => ({
  status: git(repo, 'status', '--porcelain', '--untracked-files=all'),
  branches: git(repo, 'for-each-ref', '--format=%(refname)', 'refs/heads/').split('\n').sort(),
  worktrees: git(repo, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).sort(),
  parent: readdirSync(dirname(repo)).sort(),
});
const diff = (a, b) => {
  const d = {};
  for (const k of ['branches', 'worktrees', 'parent']) {
    const added = b[k].filter((x) => !a[k].includes(x)), gone = a[k].filter((x) => !b[k].includes(x));
    if (added.length || gone.length) d[k] = { added, gone };
  }
  if (a.status !== b.status) d.status = { before: a.status, after: b.status };
  return d;
};
// Put a clone back as it was, so a leak at the base does not change the next run.
function restore(repo, before, d) {
  for (const w of d.worktrees?.added ?? []) try { git(repo, 'worktree', 'remove', '--force', w.slice(9)); } catch {}
  try { git(repo, 'worktree', 'prune'); } catch {}
  for (const b of d.branches?.added ?? []) try { git(repo, 'update-ref', '-d', b); } catch {}
  for (const p of d.parent?.added ?? []) rmSync(join(dirname(repo), p), { recursive: true, force: true });
  if (d.status) { git(repo, 'checkout', '--', '.'); git(repo, 'clean', '-fdq', '-e', 'node_modules'); }
}

const parse = (tap) => {
  const tests = [];
  for (const m of tap.matchAll(/^(\s*)(not ok|ok) \d+ - (.*?)(?: # (SKIP|TODO)\b.*)?$/gm))
    tests.push({ depth: m[1].length / 4, name: m[3], ok: m[2] === 'ok', skip: Boolean(m[4]) });
  const n = (k) => Number(tap.match(new RegExp(`^# ${k} (\\d+)$`, 'm'))?.[1] ?? NaN);
  return { tests, pass: n('pass'), fail: n('fail'), skipped: n('skipped'), duration_ms: n('duration_ms') };
};

function runFile(repo, file) {
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  return new Promise((done) => {
    const t0 = process.hrtime.bigint();
    const child = spawn(process.execPath, ['--test', '--test-reporter=tap', file], { cwd: repo, env });
    let tap = '', err = '';
    child.stdout.on('data', (b) => (tap += b));
    child.stderr.on('data', (b) => (err += b));
    child.on('close', (code) => done({ code, tap, err, ms: Number(process.hrtime.bigint() - t0) / 1e6 }));
  });
}

const summary = { base: git(base, 'rev-parse', 'HEAD'), head: git(head, 'rev-parse', 'HEAD'), rounds: [], node: process.version };
for (let round = 0; round < ROUNDS; round++) {
  const order = round % 2 === 0 ? ['base', 'head'] : ['head', 'base'];
  const r = { order, base: {}, head: {} };
  for (const side of order) {
    const repo = side === 'base' ? base : head;
    for (const file of FILES) {
      const before = snapshot(repo);
      const res = await runFile(repo, file);
      const after = snapshot(repo);
      const d = diff(before, after);
      restore(repo, before, d);
      writeFileSync(join(out, 'tap', `${round}-${side}-${file.replaceAll('/', '_')}.tap`), res.tap + '\n--- stderr\n' + res.err);
      const p = parse(res.tap);
      r[side][file] = { code: res.code, ms: Math.round(res.ms), ...p, leak: d };
      console.log(round, side, file, res.code, Math.round(res.ms), `pass ${p.pass} fail ${p.fail} skip ${p.skipped}`, Object.keys(d).length ? JSON.stringify(d) : '');
    }
  }
  summary.rounds.push(r);
  writeFileSync(join(out, 'summary.json'), JSON.stringify(summary, null, 1));
}

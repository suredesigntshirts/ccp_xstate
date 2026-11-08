// Verifier's helpers for plan item verifier-reader-gaps, written from the item's Expect lines and Verifier brief.
// VRG_REPO names the checkout under test (default: this repo). Nothing here reads the checkout's git history: each
// gate or plan run happens in a temp copy.
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.VRG_REPO ?? join(HERE, '..', '..'));
export const ITEM = 'verifier-reader-gaps';
export const read = (p) => readFileSync(join(REPO, p), 'utf8');

export function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
export const joinItem = (head, rest) => `\`\`\`json\n${JSON.stringify(head, null, 2)}\n\`\`\`\n${rest}`;

/** A markdown section, from its heading to the next heading of the same or higher level. */
export function section(text, heading) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^#+ /.test(l) && l.replace(/^#+ /, '').trim() === heading);
  if (i < 0) throw new Error(`no section "${heading}"`);
  const level = lines[i].match(/^#+/)[0].length;
  const end = lines.findIndex((l, j) => j > i && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level);
  return lines.slice(i + 1, end < 0 ? undefined : end).join('\n');
}

// The environment a gate or plan run inherits, without anything a CI job or an outer node --test sets.
export const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};
export function run(cmd, args, { cwd = REPO, env = {} } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', cwd, env: { ...cleanEnv(), ...env }, maxBuffer: 64 << 20,
    timeout: 300_000 });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}
export const node = (args, opts) => run(process.execPath, args, opts);

const GIT_ENV = { GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1', GIT_AUTHOR_NAME: 'vrg',
  GIT_AUTHOR_EMAIL: 'vrg@x', GIT_COMMITTER_NAME: 'vrg', GIT_COMMITTER_EMAIL: 'vrg@x' };

/**
 * A temp git repo whose main holds a copy of the checkout's plan/, scripts/ and package.json. commit(files, msg)
 * writes files (null deletes) and commits; git(...) runs git in it.
 */
export function tempRepo(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vrg-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  for (const p of ['plan', 'scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  const git = (...args) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...args],
    { cwd: dir, encoding: 'utf8', env: { ...process.env, ...GIT_ENV }, stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const commit = (files = {}, msg = 'commit') => {
    for (const [p, c] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, p)), { recursive: true });
      if (c === null) rmSync(join(dir, p)); else writeFileSync(join(dir, p), c);
    }
    git('add', '-A');
    git('commit', '-q', '--allow-empty', '-m', msg);
    return git('rev-parse', 'HEAD');
  };
  git('init', '-q', '-b', 'main');
  commit({}, 'base');
  return { dir, git, commit, file: (p) => readFileSync(join(dir, p), 'utf8') };
}

/** A temp copy of the checkout's plan/, with the module of each ready item made as an empty file. */
export function planCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'vrg-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  const items = join(REPO, 'plan/items');
  for (const f of execFileSync('ls', [items], { encoding: 'utf8' }).split('\n').filter((f) => f.endsWith('.md'))) {
    if (f === 'README.md') continue;
    const m = readFileSync(join(items, f), 'utf8').match(/^```json\n([\s\S]*?)\n```/);
    if (!m) continue;
    const h = JSON.parse(m[1]);
    if (h.status === 'ready' && h.module && !existsSync(join(dir, h.module))) {
      mkdirSync(dirname(join(dir, h.module)), { recursive: true });
      writeFileSync(join(dir, h.module), '');
    }
  }
  return { dir, check: () => node([join(dir, 'plan/check.mjs')], { cwd: dir }) };
}

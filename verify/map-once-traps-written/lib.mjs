// Verifier's helpers for plan item map-once-traps-written, written from the item's Expect lines and Verifier brief;
// the builder's tests are not read or used. MOT_REPO names the checkout under test (default: this repo). Nothing here
// needs git history: every mutation happens in a temp copy of the checkout.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.MOT_REPO ?? join(HERE, '..', '..'));
export const read = (p, root = REPO) => readFileSync(join(root, p), 'utf8');

export function node(args, opts = {}) {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BODY, PR_LABELS, ...env } = process.env;
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...env, ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

export const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

/** Runs test/docs.test.mjs from the checkout at `dir`. */
export const docsTest = (dir) => node(['--test', '--test-reporter=tap', join(dir, 'test/docs.test.mjs')], { cwd: dir });

/** The folders the map must name, read from the file system: top-level ones but .git, node_modules and dot folders
 * other than .github, and every folder under scripts/. */
export function folders(root = REPO) {
  const dirs = (rel) => readdirSync(join(root, rel), { withFileTypes: true })
    .filter((e) => e.isDirectory() || (e.isSymbolicLink() && rel === '.')).map((e) => e.name);
  const top = dirs('.').filter((n) => n !== '.git' && n !== 'node_modules' && (n === '.github' || !n.startsWith('.')));
  return [...top, ...dirs('scripts').map((n) => `scripts/${n}`)];
}

/** Every backticked token in the table rows of CLAUDE.md's "## Layout" section. */
export function layoutTokens(root = REPO) {
  const section = read('CLAUDE.md', root).split(/^## Layout\s*$/m)[1]?.split(/^## /m)[0] ?? '';
  const rows = section.split('\n').filter((l) => l.startsWith('|'));
  return rows.flatMap((l) => [...l.matchAll(/`([^`]+)`/g)].map((m) => m[1]));
}

/** A folder is named when a token is the folder, with or without its trailing slash or a /<placeholder> tail. */
export const named = (folder, tokens) => tokens.some((t) => t.replace(/\/<[^/]*>.*$/, '').replace(/\/$/, '') === folder);

/** A temp checkout for test/docs.test.mjs: CLAUDE.md, plan, docs, test and scripts copied, every other entry linked. */
export function docsCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'mot-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const copied = new Set(['CLAUDE.md', 'plan', 'docs', 'test', 'scripts']);
  for (const n of readdirSync(REPO)) {
    if (n === '.git' || copied.has(n)) continue;
    symlinkSync(join(REPO, n), join(dir, n));
  }
  for (const p of copied) cpSync(join(REPO, p), join(dir, p), { recursive: true });
  return dir;
}

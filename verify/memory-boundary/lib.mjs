// Shared by the memory-boundary suite: a throwaway repo whose base holds a ready item and the files a PR may touch,
// and a run of the checkout's verdict gate over one PR commit on top of it.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
/** The head verified. */
export const VERIFIED = '40dc78dd706dc13ec7a6a08f5a4ba5e52b1e30cf';
const GATE = join(REPO, 'scripts', 'gates', 'pr-gate.mjs');

const item = '```json\n{"id":"x","status":"ready","expect":[{"id":"a","proof":"world"}]}\n```\n\n## Verifier brief\n\nRun it.\n';
const BASE_FILES = {
  'plan/items/x.md': item,
  'docs/traps.md': '# Container traps\n',
  'docs/gates.md': '# Gates\n',
  'docs/layout.md': '# Layout\n',
  'CLAUDE.md': '# repo\n',
  'scripts/gates/lib.mjs': 'export const a = 1;\n',
};

/**
 * Runs the verdict gate over a PR that writes `files` (path -> text, or null to delete) on top of the base, with
 * `body` as its PR body. Returns the gate's exit status and output.
 */
export function verdictOver(t, files, body = 'Keeps a note.\n') {
  const dir = mkdtempSync(join(tmpdir(), 'mb-gate-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...a) => execFileSync('git', ['-c', 'commit.gpgsign=false', ...a], { cwd: dir, encoding: 'utf8', env: { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null' } }).trim();
  const write = (all) => {
    for (const [p, text] of Object.entries(all)) {
      if (text === null) { rmSync(join(dir, p)); continue; }
      mkdirSync(join(dir, dirname(p)), { recursive: true });
      writeFileSync(join(dir, p), text);
    }
    git('add', '-A');
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 't');
  write(BASE_FILES);
  git('commit', '-q', '-m', 'base');
  const base = git('rev-parse', 'HEAD');
  write(files);
  git('commit', '-q', '-m', 'note\n\nClaude-Session: https://claude.ai/code/session_test');
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  const r = spawnSync(process.execPath, [GATE, 'verdict'], {
    cwd: dir, encoding: 'utf8',
    env: { ...env, BASE_SHA: base, HEAD_SHA: git('rev-parse', 'HEAD'), PR_BRANCH: 'notes/x', PR_BODY: body, PR_LABELS: '[]' },
  });
  return { status: r.status, out: r.stdout + r.stderr };
}

// Verifier's helpers for plan item stage-prompt-reader-gaps, written from the item's Expect lines and Verifier brief;
// the builder's tests are not read or used. SPRG_REPO names the checkout under test (default: this repo). Nothing here
// needs git history, so a depth-1 checkout works.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const EVIDENCE = join(HERE, 'evidence');
export const REPO = resolve(process.env.SPRG_REPO ?? join(HERE, '..', '..'));
export const ITEM = 'stage-prompt-reader-gaps';
export const read = (p) => readFileSync(join(REPO, p), 'utf8');
/** A text with its line breaks and runs of spaces read as one space, so a reflow changes nothing. */
export const flat = (s) => s.replace(/\s+/g, ' ');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};
export function node(args, { cwd = REPO, env = {} } = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd, env: { ...cleanEnv(), ...env },
    maxBuffer: 64 << 20, timeout: 300_000 });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}`, stdout: r.stdout ?? '' };
}

function find(dir, name) {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) { const f = find(p, name); if (f) return f; } else if (e === name) return p;
  }
  return null;
}

/** The prompt and context the engine renders for one stage, by scripts/bench/run.mjs --prompt-only at REPO. */
export function render(stage, args) {
  const out = mkdtempSync(join(tmpdir(), 'sprg-render-'));
  try {
    const r = node([join(REPO, 'scripts/bench/run.mjs'), '--stage', stage, '--prompt-only', ...args, '--out', out]);
    if (r.status !== 0) throw new Error(`render ${stage} failed: ${r.out}`);
    return { prompt: readFileSync(find(out, 'prompt.md'), 'utf8'), context: readFileSync(find(out, 'context.md'), 'utf8') };
  } finally { rmSync(out, { recursive: true, force: true }); }
}

/** A prompt's `## <name>` part, up to the next `## ` heading. */
export function part(prompt, name) {
  const m = prompt.match(new RegExp(`^## ${name}\\n([\\s\\S]*?)(?=^## |(?![\\s\\S]))`, 'm'));
  if (!m) throw new Error(`no part ${name}`);
  return m[1];
}

/** The words the harness itself gives a stage: every part but Task, and no input value lines ("  = ..."). */
export const harnessWords = (prompt) =>
  prompt.replace(/^## Task\n[\s\S]*?(?=^## )/m, '').split('\n').filter((l) => !l.startsWith('  = ')).join('\n');

/** The output bullet `- <key>: ...` of a prompt's Output part. */
export function outputLine(prompt, key) {
  const l = part(prompt, 'Output').split('\n').find((x) => x.startsWith(`- ${key}: `));
  if (!l) throw new Error(`no output ${key}`);
  return l;
}

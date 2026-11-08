// Verifier's helpers for plan item rule-text-tests, written from the item's Expect lines and Verifier brief.
// RTT_REPO names the checkout under test (default: this repo). Nothing here reads git history.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.RTT_REPO ?? join(HERE, '..', '..'));
export const read = (p) => readFileSync(join(REPO, p), 'utf8');
export const ITEM = 'rule-text-tests';
export const headOf = (text) => JSON.parse(text.match(/^```json\n([\s\S]*?)\n```/)[1]);

/** A section of a markdown text, from its heading to the next heading of the same or higher level. */
export function section(text, heading) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^#+ /.test(l) && l.replace(/^#+ /, '').trim() === heading);
  if (i < 0) throw new Error(`no section "${heading}"`);
  const level = lines[i].match(/^#+/)[0].length;
  const end = lines.findIndex((l, j) => j > i && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level);
  return lines.slice(i + 1, end < 0 ? undefined : end).join('\n');
}

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};
export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: cleanEnv(), cwd: opts.cwd ?? REPO,
    maxBuffer: 64 << 20, timeout: 300_000 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

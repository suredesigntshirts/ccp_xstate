// Verifier's helpers for plan item after-verdict-gaps, written from the item's Expect lines and Verifier brief; the
// builder's tests are not read or used. AVG_REPO names the checkout under test (default: this repo). Nothing here
// reads git history of the checkout, so a depth-1 checkout works.
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.AVG_REPO ?? join(HERE, '..', '..'));
export const ITEM = 'after-verdict-gaps';
export const read = (p) => readFileSync(join(REPO, p), 'utf8');
/** A text with its line breaks and runs of spaces read as one space, so a reflow changes nothing. */
export const flat = (s) => s.replace(/\s+/g, ' ');

/** A markdown section, from its heading to the next heading of the same or higher level. */
export function section(text, heading) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => /^#+ /.test(l) && l.replace(/^#+ /, '').trim() === heading);
  if (i < 0) throw new Error(`no section "${heading}"`);
  const level = lines[i].match(/^#+/)[0].length;
  const end = lines.findIndex((l, j) => j > i && /^#+ /.test(l) && l.match(/^#+/)[0].length <= level);
  return lines.slice(i + 1, end < 0 ? undefined : end).join('\n');
}

/** A numbered step of a markdown list, from "<n>. " to the next step or blank line. */
export function step(text, n) {
  const lines = text.split('\n');
  const i = lines.findIndex((l) => l.startsWith(`${n}. `));
  if (i < 0) throw new Error(`no step ${n}`);
  const end = lines.findIndex((l, j) => j > i && (/^\d+\. /.test(l) || l.trim() === ''));
  return flat(lines.slice(i, end < 0 ? undefined : end).join('\n'));
}

/** The glossary row whose first cell is `term`, as its cells. */
export function term(text, name) {
  const row = text.split('\n').find((l) => l.startsWith(`| ${name} |`));
  return row ? row.split('|').slice(1, -1).map((c) => c.trim()) : null;
}

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};
export function node(args, { cwd = REPO, env = {} } = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd, env: { ...cleanEnv(), ...env },
    maxBuffer: 64 << 20, timeout: 300_000 });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

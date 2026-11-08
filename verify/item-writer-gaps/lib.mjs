// Verifier's helpers for plan item item-writer-gaps, written from the item's Expect lines and Verifier brief; the
// builder's tests are not read or used. IWG_REPO names the checkout under test (default: this repo). Nothing here
// reads git history: each plan run happens in a temp copy, so a depth-1 checkout works.
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.IWG_REPO ?? join(HERE, '..', '..'));
export const ITEM = 'item-writer-gaps';
export const read = (p) => readFileSync(join(REPO, p), 'utf8');
/** A text with its line breaks and runs of spaces read as one space, so a reflow changes nothing. */
export const flat = (s) => s.replace(/\s+/g, ' ');

const HEAD_RE = /^```json\n([\s\S]*?)\n```\n/;
export function splitItem(text) {
  const m = text.match(HEAD_RE);
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

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};
export function node(args, { cwd = REPO, env = {} } = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', cwd, env: { ...cleanEnv(), ...env },
    maxBuffer: 64 << 20, timeout: 300_000 });
  return { status: r.status, out: `${r.stdout ?? ''}${r.stderr ?? ''}` };
}

/**
 * A temp copy of the checkout's plan/, with the module of each ready item made as an empty file. add(head, rest)
 * writes an item file; check() runs the copy's plan check.
 */
export function planCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'iwg-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  for (const f of readdirSync(join(REPO, 'plan/items')).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    const m = readFileSync(join(REPO, 'plan/items', f), 'utf8').match(HEAD_RE);
    if (!m) continue;
    const h = JSON.parse(m[1]);
    if (h.status === 'ready' && h.module && !existsSync(join(dir, h.module))) {
      mkdirSync(dirname(join(dir, h.module)), { recursive: true });
      writeFileSync(join(dir, h.module), '');
    }
  }
  return {
    dir,
    add: (head, rest) => writeFileSync(join(dir, 'plan/items', `${head.id}.md`), joinItem(head, rest)),
    check: () => node([join(dir, 'plan/check.mjs')], { cwd: dir }),
  };
}

/** This item's own file, made into a ready item with a new id and no dependants, as a base for a test item. */
export function readyItem(id, fields = {}) {
  const { head, rest } = splitItem(read(`plan/items/${ITEM}.md`));
  const { module, done_on, ...bare } = head;
  return { head: { ...bare, id, status: 'ready', ...fields }, rest };
}

// Verifier's helpers for plan item fix-budget-rule, written from the item's Expect lines; the builder's tests
// (test/plan-check.test.mjs) are not read or used. FBR_REPO names the checkout under test (default: this repo).
import { execFileSync, spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(process.env.FBR_REPO ?? join(HERE, '..', '..'));

const HEAD_RE = /^```json\n([\s\S]*?)\n```/;
export const headOf = (text) => JSON.parse(text.match(HEAD_RE)[1]);
export const withHead = (text, head) => text.replace(HEAD_RE, '```json\n' + JSON.stringify(head, null, 2) + '\n```');

/** A day N days before today, as YYYY-MM-DD in UTC (the check counts from today's UTC date). */
export const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);

/** A temp folder holding a copy of the checkout's plan/ at <dir>/plan, with module paths made under <dir>. */
export function tempPlan(t) {
  const dir = mkdtempSync(join(tmpdir(), 'fbr-'));
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  t?.after?.(() => rmSync(dir, { recursive: true, force: true }));
  // A done fix item with a complete ready head and a Verifier brief, used as the template for new items.
  const template = readFileSync(join(REPO, 'plan/items/fix-finish-closes-waits.md'), 'utf8');
  const plan = {
    dir,
    touch(p) { mkdirSync(dirname(join(dir, p)), { recursive: true }); writeFileSync(join(dir, p), '// module\n'); },
    /** Add an item cloned from the template: fields override the head; a field set to undefined is removed. */
    add(id, fields) {
      const head = { ...headOf(template), id };
      for (const [k, v] of Object.entries(fields)) { if (v === undefined) delete head[k]; else head[k] = v; }
      writeFileSync(join(dir, 'plan/items', `${id}.md`), withHead(template, head));
    },
    edit(id, fields) {
      const f = join(dir, 'plan/items', `${id}.md`);
      const text = readFileSync(f, 'utf8');
      const head = headOf(text);
      for (const [k, v] of Object.entries(fields)) { if (v === undefined) delete head[k]; else head[k] = v; }
      writeFileSync(f, withHead(text, head));
    },
    run() {
      const r = spawnSync(process.execPath, [join(dir, 'plan/check.mjs')], { encoding: 'utf8' });
      return { code: r.status, out: r.stdout + r.stderr };
    },
  };
  return plan;
}

export const git = (...args) => execFileSync('git', ['-C', REPO, ...args], { encoding: 'utf8', maxBuffer: 1 << 26 });

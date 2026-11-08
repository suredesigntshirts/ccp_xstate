// Verifier's helpers for plan item item-head-trim, written from the item's Expect lines and Verifier brief. REPO is the
// checkout under test. Nothing here reads git history, so the tests pass in ci.yml's depth-1 checkout.
import { spawnSync } from 'node:child_process';
import { cpSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(join(HERE, '..', '..'));
export const read = (p) => readFileSync(join(REPO, p), 'utf8');

const cleanEnv = () => {
  const { NODE_TEST_CONTEXT, BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY, PR_LABELS, ...env } = process.env;
  return env;
};

export function node(args, opts = {}) {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env: { ...cleanEnv(), ...opts.env }, cwd: opts.cwd,
    maxBuffer: 64 << 20 });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

export function splitItem(text) {
  const m = text.match(/^```json\n([\s\S]*?)\n```\n/);
  return { head: JSON.parse(m[1]), rest: text.slice(m[0].length) };
}
export const joinItem = (head, rest) => '```json\n' + JSON.stringify(head, null, 2) + '\n```\n' + rest;

/** Every item head in a plan/ folder, by file name. */
export function heads(planDir = join(REPO, 'plan')) {
  const dir = join(planDir, 'items');
  return readdirSync(dir).filter((n) => n.endsWith('.md'))
    .map((n) => ({ file: n, ...splitItem(readFileSync(join(dir, n), 'utf8')) }));
}

/**
 * Copies plan/ into dir, and makes each module a ready item names, since the copy holds plan/ alone and the
 * plan check refuses a ready item whose module is missing.
 */
export function copyPlan(dir) {
  cpSync(join(REPO, 'plan'), join(dir, 'plan'), { recursive: true });
  for (const { head } of heads()) {
    if (!head.module || head.status !== 'ready') continue;
    mkdirSync(dirname(join(dir, head.module)), { recursive: true });
    writeFileSync(join(dir, head.module), '');
  }
}

/**
 * A temp copy of the head's whole plan/. withItem(id, edit) writes plan/items/<id>.md from the item-head-trim file
 * (head made ready under the new id, with no verifier and no step_back, then passed to edit) and runs the copy's
 * check.mjs, returning { status, out }.
 */
export function planCopy(t) {
  const dir = mkdtempSync(join(tmpdir(), 'iht-plan-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  copyPlan(dir);
  const src = splitItem(read('plan/items/item-head-trim.md'));
  const check = () => node([join(dir, 'plan/check.mjs')], { cwd: dir });
  return {
    dir, check,
    withItem(id, edit = (h) => h) {
      const { verifier, step_back, ...rest } = src.head;
      const head = edit({ ...rest, id, status: 'ready' });
      writeFileSync(join(dir, 'plan/items', `${id}.md`), joinItem(head, src.rest));
      return { head, ...check() };
    },
  };
}

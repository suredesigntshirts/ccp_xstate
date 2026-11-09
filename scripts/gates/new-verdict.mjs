#!/usr/bin/env node
// Writes the skeleton of verify/<item>/verdict.json (docs/gates.md, "The verdict") from what a verifier could get wrong
// by hand: verified_sha is the full commit id git gives, the session is this thread's own, from
// CLAUDE_CODE_REMOTE_SESSION_ID, and each Expect line of the item's head gets one result with the slots its proof
// needs. Status, command and excerpt stay empty, so the verdict gate refuses the file until the verifier fills them.
// It prints the Claude-Session trailer to commit the verdict with.
//
//   node scripts/gates/new-verdict.mjs <item> [--sha <rev>] [--model <id>] [--force]
//
// Run it from the checkout the verifier checked: <rev> defaults to HEAD. --force replaces a verdict that exists.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { itemHead } from './lib.mjs';

/** The session URL a Claude-Session trailer names for a remote session id (cse_... is the session_... page). */
export const sessionUrl = (id) => `https://claude.ai/code/${id.replace(/^cse_/, 'session_')}`;

/** The skeleton verdict for `head` (an item head) at `sha`, verified by `session` with `model`. */
export function skeleton({ head, sha, session, model = '' }) {
  return {
    item: head.id,
    verified_sha: sha,
    verifier: { session, model },
    results: (head.expect ?? []).map((e) => ({
      id: e.id,
      status: '',
      command: '',
      excerpt: '',
      ...(e.proof === 'verifier' || e.proof === 'builder' ? { test: `verify/${head.id}/` } : {}),
      ...(e.proof === 'builder' ? { mutation: '', red_test: '' } : {})
    })),
    observations: []
  };
}

/** Writes the skeleton in the repo at `cwd`; returns { path, trailer }. Throws with the reason it refuses. */
export function write({ item, cwd = process.cwd(), rev = 'HEAD', model = '', force = false, env = process.env }) {
  const id = env.CLAUDE_CODE_REMOTE_SESSION_ID;
  if (!id) throw new Error('CLAUDE_CODE_REMOTE_SESSION_ID is not set, so this session has no Claude-Session to name; run it in the verifier thread itself');
  const git = (...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  const sha = git('rev-parse', '--verify', `${rev}^{commit}`);
  const file = join(cwd, 'plan', 'items', `${item}.md`);
  if (!existsSync(file)) throw new Error(`no plan/items/${item}.md here`);
  const head = itemHead(readFileSync(file, 'utf8'));
  if (!head) throw new Error(`plan/items/${item}.md has no JSON head`);
  if (!head.expect?.length) throw new Error(`${item} has no Expect lines to verify`);
  const path = join('verify', item, 'verdict.json');
  if (existsSync(join(cwd, path)) && !force) throw new Error(`${path} exists; pass --force to replace it`);
  const session = sessionUrl(id);
  mkdirSync(join(cwd, 'verify', item), { recursive: true });
  writeFileSync(join(cwd, path), `${JSON.stringify(skeleton({ head, sha, session, model }), null, 2)}\n`);
  return { path, sha, trailer: `Claude-Session: ${session}` };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (name) => { const i = argv.indexOf(`--${name}`); return i >= 0 ? argv.splice(i, 2)[1] : undefined; };
  const rev = opt('sha') ?? 'HEAD';
  const model = opt('model') ?? '';
  const force = argv.includes('--force');
  const rest = argv.filter((a) => a !== '--force');
  if (rest.length !== 1 || rest[0].startsWith('-')) {
    console.error('usage: new-verdict.mjs <item> [--sha <rev>] [--model <id>] [--force]');
    process.exit(2);
  }
  try {
    const { path, sha, trailer } = write({ item: rest[0], rev, model, force });
    console.log(`wrote ${path} for ${sha}; fill each result, then commit it with:\n${trailer}`);
  } catch (e) {
    console.error(`new-verdict: ${e.message}`);
    process.exit(1);
  }
}

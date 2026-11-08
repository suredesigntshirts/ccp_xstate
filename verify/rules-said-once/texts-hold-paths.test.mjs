// Expect texts-hold-paths: every repo path CLAUDE.md, plan/README.md and the files under docs/ write in backticks
// exists, and the entry texts fit their line budgets. A backticked token is a path when it has a "/" or ends in
// .md, .mjs, .js, .json or .yml; it is a repo path when its first segment is a top-level entry of the repo. A token
// holding <...> or a glob sign is a pattern. `.claude/...` names Claude Code's own config location in any project,
// not this repo's folder, so it is left out. plan/README.md's bare file names are read relative to plan/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, read } from './lib.mjs';

const TOP = new Set(readdirSync(REPO).filter((n) => n !== '.git' && n !== 'node_modules' && n !== '.claude'));
const TEXTS = ['CLAUDE.md', 'plan/README.md', ...readdirSync(join(REPO, 'docs'), { recursive: true })
  .map((f) => `docs/${f}`).filter((f) => statSync(join(REPO, f)).isFile())];
const lines = (p) => { const s = read(p); return s.split('\n').length - (s.endsWith('\n') ? 1 : 0); };

export function tokens(text) {
  return [...text.matchAll(/`([^`\n]+)`/g)].map((m) => m[1].replace(/[.,:;]$/, ''))
    .filter((t) => !/\s/.test(t) && !/[<*?{]/.test(t) && (t.includes('/') || /\.(md|mjs|js|json|yml)$/.test(t)));
}
export const repoPaths = (text) => tokens(text).filter((t) => TOP.has(t.split('/')[0]));

test('every repo path the texts name in backticks exists at the head', (t) => {
  let checked = 0;
  const missing = [];
  for (const file of TEXTS) for (const p of new Set(repoPaths(read(file)))) {
    checked++;
    if (!existsSync(join(REPO, p))) missing.push(`${file}: ${p}`);
  }
  t.diagnostic(`${TEXTS.length} texts, ${checked} distinct repo paths checked`);
  assert.ok(TEXTS.length >= 8 && checked > 100, `too few paths checked: ${checked}`);
  assert.deepEqual(missing, []);
});

test("plan/README.md's bare file names exist under plan/", () => {
  const bare = tokens(read('plan/README.md')).filter((t) => !t.includes('/') && !TOP.has(t));
  const missing = bare.filter((t) => !existsSync(join(REPO, 'plan', t)) && !existsSync(join(REPO, t)));
  // actors.js is the engine module named as an example in a table row; it lives under packages/engine/src/.
  assert.deepEqual(missing.filter((t) => t !== 'actors.js'), []);
  assert.ok(existsSync(join(REPO, 'packages/engine/src/actors.js')));
});

test('CLAUDE.md has fewer than 100 lines; CLAUDE.md, plan/README.md and docs/gates.md fewer than 230 together', (t) => {
  const c = ['CLAUDE.md', 'plan/README.md', 'docs/gates.md'].map((p) => [p, lines(p)]);
  const total = c.reduce((n, [, k]) => n + k, 0);
  t.diagnostic(`${c.map(([p, k]) => `${p} ${k}`).join(', ')}; total ${total}`);
  assert.ok(c[0][1] < 100, `CLAUDE.md has ${c[0][1]} lines`);
  assert.ok(total < 230, `total ${total}`);
});

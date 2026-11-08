// The rule texts a thread reads stay true and short: every repo path they name in backticks exists, and the three
// texts read before any item fit a line budget. A path is a repo path when its first segment is a top-level folder or
// file of this repo; one holding <...> or another placeholder sign is a pattern, not a path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const REPO = join(import.meta.dirname, '..');
const ENTRY = ['CLAUDE.md', 'plan/README.md', 'docs/gates.md'];
const BUDGET = 230;
const TEXTS = ['CLAUDE.md', 'plan/README.md', ...readdirSync(join(REPO, 'docs')).filter((f) => f.endsWith('.md')).map((f) => `docs/${f}`)];

const read = (path) => readFileSync(join(REPO, path), 'utf8');
const lineCount = (text) => text.split('\n').length - (text.endsWith('\n') ? 1 : 0);
const top = new Set(readdirSync(REPO).filter((n) => n !== 'node_modules' && n !== '.git' && (n === '.github' || !n.startsWith('.'))));

export function repoPaths(text) {
  return [...text.matchAll(/`([^`\s]+)`/g)].map((m) => m[1])
    .filter((t) => !/[<>*{}$=#~]/.test(t) && top.has(t.split('/')[0]));
}

for (const path of TEXTS) {
  test(`every repo path ${path} names exists`, () => {
    const missing = [...new Set(repoPaths(read(path)))].filter((p) => !existsSync(join(REPO, p)));
    assert.deepEqual(missing, [], `${path} names paths that do not exist`);
  });
}

test('CLAUDE.md has fewer than 100 lines', () => {
  assert.ok(lineCount(read('CLAUDE.md')) < 100);
});

test(`the texts read before any item have fewer than ${BUDGET} lines together`, () => {
  const counts = ENTRY.map((p) => [p, lineCount(read(p))]);
  const total = counts.reduce((n, [, c]) => n + c, 0);
  assert.ok(total < BUDGET, `${counts.map(([p, c]) => `${p} ${c}`).join(', ')}: ${total} lines`);
});

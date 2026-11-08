// Expect texts-name-the-path: plan/README.md, docs/gates.md, docs/language.md, CLAUDE.md, plan/check.mjs and every
// file under scripts/gates/ name no doing status; plan/README.md names every status item.schema.json allows.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, read } from './lib.mjs';

const walk = (rel) => readdirSync(join(REPO, rel)).flatMap((f) => {
  const p = `${rel}/${f}`;
  return statSync(join(REPO, p)).isDirectory() ? walk(p) : [p];
});
const FILES = ['plan/README.md', 'docs/gates.md', 'docs/language.md', 'CLAUDE.md', 'plan/check.mjs', ...walk('scripts/gates')];

test('none of the path texts names doing', (t) => {
  const hits = FILES.flatMap((f) => read(f).split('\n').map((l, i) => [f, i + 1, l]).filter(([, , l]) => /\bdoing\b/i.test(l)));
  t.diagnostic(`${FILES.length} files read: ${FILES.join(', ')}`);
  assert.deepEqual(hits.map(([f, n, l]) => `${f}:${n}: ${l.trim()}`), []);
});

test('plan/README.md names every status the schema allows, and the schema leaves doing out', (t) => {
  const statuses = JSON.parse(read('plan/item.schema.json')).properties.status.enum;
  t.diagnostic(`schema statuses: ${statuses.join(', ')}`);
  assert.ok(!statuses.includes('doing'));
  const readme = read('plan/README.md');
  const missing = statuses.filter((s) => !readme.includes(`\`${s}\``));
  assert.deepEqual(missing, []);
});

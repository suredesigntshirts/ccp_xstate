// Verifier tests for plan item tournament-kit, Expect `index`: tournaments/README.md lists 2026-11-03-context with its
// question, winner, scratch issue and viewer links, and docs/tournaments.md walks a new tournament end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('tournaments/README.md has a 2026-11-03-context row with question, winner, issue and viewer', () => {
  const config = JSON.parse(read('tournaments/2026-11-03-context/config.json'));
  const row = read('tournaments/README.md').split('\n').find((l) => l.startsWith('|') && l.includes('2026-11-03-context'));
  assert.ok(row, 'no index row for 2026-11-03-context');
  const cells = row.split('|').map((c) => c.trim());
  assert.match(cells[2], /What passes between states/, 'question');
  assert.match(cells[3], new RegExp(config.record.winner), 'winner');
  assert.ok(row.includes(config.record.issue), 'scratch issue link');
  assert.ok(row.includes(config.record.viewer), 'viewer link');
  for (const n of Object.values(config.record.prs)) assert.ok(row.includes(`/pull/${n}`), `lane PR #${n}`);
});

test('docs/tournaments.md walks a new tournament end to end', () => {
  const doc = read('docs/tournaments.md');
  const steps = [
    /write the folder/i,
    /scripts\/tournament\/args\.mjs/,
    /dry-run\.mjs/,
    /runner\.workflow\.js/,
    /push the lanes/i,
    /ci\/tournament\.yml/,
    /read ci/i,
    /measure\.mjs/,
    /tournaments\/README\.md/
  ];
  let at = 0;
  for (const re of steps) {
    const i = doc.slice(at).search(re);
    assert.ok(i >= 0, `doc is missing (in order) ${re}`);
    at += i;
  }
});

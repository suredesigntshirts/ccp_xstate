// folders-hold-verdicts: each of the 19 suites' folders holds verdict.json and nothing else, and the verdict parses
// with its item equal to the folder name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, SUITES, walk } from './lib.mjs';

test('folders-hold-verdicts: each of the 19 folders holds only verdict.json, naming its folder', () => {
  assert.equal(SUITES.length, 19);
  for (const s of SUITES) {
    const dir = join(REPO, 'verify', s);
    assert.deepEqual(walk(dir, dir), ['verdict.json'], s);
    const v = JSON.parse(readFileSync(join(dir, 'verdict.json'), 'utf8'));
    assert.equal(v.item, s, `${s}/verdict.json item`);
  }
});

test('folders-hold-verdicts: the reader sees a second file (control)', () => {
  const others = readdirSync(join(REPO, 'verify')).filter((n) => !SUITES.includes(n));
  assert.ok(others.some((n) => walk(join(REPO, 'verify', n), join(REPO, 'verify', n)).length > 1));
});

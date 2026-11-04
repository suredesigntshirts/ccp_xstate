// Verifier's own check of the args-refuse line (the line's proof is the builder's tests; this is extra evidence).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, '../..');
const argsCli = path.join(repo, 'scripts/tournament/args.mjs');

const run = (folder) => spawnSync(process.execPath, [argsCli, folder], { cwd: repo, encoding: 'utf8' });

function copyWith(folder, edit) {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'verify-tsf-args-')), path.basename(folder));
  fs.cpSync(folder, dir, { recursive: true });
  const c = JSON.parse(fs.readFileSync(path.join(dir, 'config.json'), 'utf8'));
  edit(c);
  fs.writeFileSync(path.join(dir, 'config.json'), JSON.stringify(c, null, 2));
  return dir;
}

for (const folder of [path.join(repo, 'tournaments/2026-11-03-context'), path.join(here, 'toy/2026-11-04-recipe-cards')]) {
  const name = path.basename(folder);
  test(`args: ${name} builds args, with its scoring as floors and trade-offs`, () => {
    const c = JSON.parse(fs.readFileSync(path.join(folder, 'config.json'), 'utf8'));
    assert.ok(c.scoring.floors && Array.isArray(c.scoring.tradeoffs) && c.scoring.tradeoffs.length >= 2);
    const r = run(folder);
    assert.equal(r.status, 0, r.stderr);
    const args = JSON.parse(r.stdout);
    assert.match(args.scoring.text, /^Floors/);
  });

  test(`args: ${name} with its floors removed is refused`, () => {
    const r = run(copyWith(folder, (c) => delete c.scoring.floors));
    assert.equal(r.status, 1);
    assert.match(r.stderr, /floors/);
  });

  test(`args: ${name} with empty floors, one trade-off, or only a free-text rule is refused`, () => {
    for (const edit of [
      (c) => (c.scoring.floors = {}),
      (c) => (c.scoring.floors = { scenarios: [], contractTests: [], constraints: [] }),
      (c) => (c.scoring.tradeoffs = c.scoring.tradeoffs.slice(0, 1)),
      (c) => (c.scoring = { rule: 'Rank on weighted primitive count alone.' })
    ]) {
      const r = run(copyWith(folder, edit));
      assert.equal(r.status, 1, `expected refusal for ${edit}`);
    }
  });
}

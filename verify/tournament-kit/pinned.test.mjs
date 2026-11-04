// Verifier tests for plan item tournament-kit, Expect `pinned`: each tournament folder's config.json records the
// base repo and sha, lanes, stages, scoring (floors and trade-offs since tournament-scoring-floors) and runner sha, and args.mjs refuses a folder missing any of them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const ARGS = path.join(ROOT, 'scripts/tournament/args.mjs');
const TOY = path.join(HERE, 'toy/2026-11-04-readme-structure');
const ID = path.basename(TOY);

const FIELDS = [['base'], ['base', 'repo'], ['base', 'sha'], ['lanes'], ['stages'], ['scoring'], ['scoring', 'floors'], ['scoring', 'tradeoffs'], ['runner'], ['runner', 'sha']];

function present(c, p) {
  let v = c;
  for (const k of p) v = v?.[k];
  if (Array.isArray(v)) return v.length > 0;
  return v !== undefined && v !== null && v !== '';
}

test('every tournaments/<id>/config.json records the pinned fields', () => {
  const dir = path.join(ROOT, 'tournaments');
  const ids = fs.readdirSync(dir).filter((d) => fs.existsSync(path.join(dir, d, 'config.json')));
  assert.ok(ids.includes('2026-11-03-context'));
  for (const id of ids) {
    const c = JSON.parse(fs.readFileSync(path.join(dir, id, 'config.json'), 'utf8'));
    for (const f of FIELDS) assert.ok(present(c, f), `${id}: ${f.join('.')} missing`);
    assert.match(c.base.sha, /^[0-9a-f]{40}$/);
    assert.match(c.runner.sha, /^[0-9a-f]{40}$/);
    // and the real folder builds
    const r = spawnSync(process.execPath, [ARGS, path.join(dir, id)], { encoding: 'utf8' });
    assert.equal(r.status, 0, `${id}: ${r.stderr}`);
  }
});

function runWithout(fieldPath, mode) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vtk-pinned-'));
  const folder = path.join(tmp, ID);
  fs.cpSync(TOY, folder, { recursive: true });
  const c = JSON.parse(fs.readFileSync(path.join(folder, 'config.json'), 'utf8'));
  let o = c;
  for (const k of fieldPath.slice(0, -1)) o = o[k];
  const last = fieldPath[fieldPath.length - 1];
  if (mode === 'delete') delete o[last];
  else o[last] = Array.isArray(o[last]) ? [] : '';
  fs.writeFileSync(path.join(folder, 'config.json'), JSON.stringify(c));
  const r = spawnSync(process.execPath, [ARGS, folder], { encoding: 'utf8' });
  fs.rmSync(tmp, { recursive: true, force: true });
  return r;
}

test('the untouched toy folder is accepted (control)', () => {
  const r = spawnSync(process.execPath, [ARGS, TOY], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});

for (const f of FIELDS) {
  for (const mode of ['delete', 'empty']) {
    test(`args.mjs refuses a config with ${f.join('.')} ${mode === 'delete' ? 'deleted' : 'emptied'}`, () => {
      const r = runWithout(f, mode);
      assert.notEqual(r.status, 0, `accepted without ${f.join('.')}`);
      assert.match(r.stderr, /refused/);
      assert.equal(r.stdout.trim(), '', 'no args printed');
    });
  }
}

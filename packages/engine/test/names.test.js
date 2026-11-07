import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as names from '../src/names.js';

const root = '/j';

test('a run id parses into its item and name, and formats back', () => {
  assert.deepEqual(names.runOf('quick-fix-7:3.brief'), { item: 'quick-fix-7', name: '3.brief' });
  assert.deepEqual(names.runOf('a:b:12.fix-it'), { item: 'a:b', name: '12.fix-it' });
  assert.equal(names.runId('quick-fix-7', '3.brief'), 'quick-fix-7:3.brief');
  for (const bad of ['quick-fix-7', 'x:brief', 'x:3.', null, undefined, '']) assert.equal(names.runOf(bad), null);
});

test('safe keeps letters, digits, dot, underscore and dash, and turns the rest into _', () => {
  assert.equal(names.safe('a-b_c.9'), 'a-b_c.9');
  assert.equal(names.safe('a/b c:d'), 'a_b_c_d');
});

test('the files of an item, run, card, agent and spawn sit where the journal keeps them', () => {
  assert.equal(names.itemFile(root, 'it-1'), join(root, 'items', 'it-1.jsonl'));
  assert.equal(names.sessionFile(root, 's1'), join(root, 'sessions', 's1.jsonl'));
  assert.equal(names.runsDir(root, 'a/b'), join(root, 'items', 'a_b', 'runs'));
  assert.equal(names.runDir(root, 'a/b:2.fix'), join(root, 'items', 'a_b', 'runs', '2.fix'));
  assert.equal(names.runDir(root, 'not a run'), null);
  assert.equal(names.cardFile(root, 'it:4.ask'), join(root, 'items', 'it', 'cards', '4.ask.json'));
  assert.equal(names.closedFile(root, 'it:4.ask'), join(root, 'items', 'it', 'cards', '4.ask.closed.json'));
  assert.throws(() => names.cardFile(root, 'it'), /not a run id/);
  assert.equal(names.agentFile(root, 'ag/1'), join(root, 'actors', 'agents', 'ag_1.json'));
  assert.equal(names.spawnFile(root, 'tu 1'), join(root, 'actors', 'spawns', 'tu_1.json'));
});

test('the result hash does not depend on key order, at any depth, and does depend on values', () => {
  const a = { pr: { url: 'u', head: 'h' }, list: [{ x: 1, y: 2 }], ok: true };
  const b = { ok: true, list: [{ y: 2, x: 1 }], pr: { head: 'h', url: 'u' } };
  assert.equal(names.resultHash(a), names.resultHash(b));
  assert.notEqual(names.resultHash(a), names.resultHash({ ...a, ok: false }));
  assert.notEqual(names.resultHash({ list: [1, 2] }), names.resultHash({ list: [2, 1] }));
  assert.equal(names.resultHash(undefined), names.resultHash(null));
  assert.equal(names.resultHash({ b: 1, a: 2 }), names.sha256('{"a":2,"b":1}'));
});

test('names.js imports only node: built-ins', () => {
  const source = readFileSync(new URL('../src/names.js', import.meta.url), 'utf8');
  const from = [...source.matchAll(/^import[^;]*?from\s+'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(from.length > 0);
  for (const f of from) assert.match(f, /^node:/);
});

test('promptFile is the run folder\'s prompt.md, or the older brief.md when only that one is there', () => {
  const root = mkdtempSync(join(tmpdir(), 'names-'));
  const dir = names.runDir(root, 'it-1:0.build');
  assert.equal(names.promptFile(root, 'it-1:0.build'), join(dir, 'prompt.md'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'brief.md'), 'old');
  assert.equal(names.promptFile(root, 'it-1:0.build'), join(dir, 'brief.md'));
  writeFileSync(join(dir, 'prompt.md'), 'new');
  assert.equal(names.promptFile(root, 'it-1:0.build'), join(dir, 'prompt.md'));
  assert.equal(names.promptFile(root, 'not a run'), null);
});

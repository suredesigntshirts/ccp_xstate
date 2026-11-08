// unmarked-as-main, prompts-unchanged and kinds-declare-stamps: capture.mjs run on this checkout gives what it gave on
// main (evidence/main.json, captured at 28c2d8f): prompts, load outcomes, coverGap answers and accept's answers, rows
// and stored blobs.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { HERE, REPO } from './lib.mjs';
import { accepts, gaps, loads, prompts } from './capture.mjs';

const MAIN = JSON.parse(readFileSync(join(HERE, 'evidence', 'main.json'), 'utf8'));

test('prompts-unchanged: every stage invoke of the four workflows renders the same sections and prompt as main; meta.actors and stage files are main\'s', async () => {
  const now = await prompts(REPO);
  assert.equal(Object.keys(now.sections).length, 13);
  assert.deepEqual(now, MAIN.prompts);
});

test('unmarked-as-main: the repo workflows without meta.marks, and changed copies of them, load or are refused as on main, with the same message', async () => {
  const now = await loads(REPO);
  assert.deepEqual(now.variants, MAIN.loads.variants);
  // Without marks the head's workflow files are main's bytes: the same pinned ids.
  for (const n of ['quick-fix', 'research', 'intake', 'feature']) assert.match(now.variants[`quick-fix as is: ${n}`].ok, new RegExp(`^${n}@`));
});

test('unmarked-as-main: every workflow blob pinned in the committed journals loads as on main', async () => {
  const now = await loads(REPO);
  const shared = Object.keys(MAIN.loads.pinned).filter((k) => k in now.pinned);
  assert.ok(shared.length >= 10, `${shared.length} pinned blobs compared`);
  for (const k of shared) assert.deepEqual(now.pinned[k], MAIN.loads.pinned[k], k);
});

test('unmarked-as-main: coverGap and uncovered answer as on main without marks', async () => {
  assert.deepEqual(await gaps(REPO), MAIN.gaps);
});

test('unmarked-as-main and kinds-declare-stamps: accept returns, journals and stores the same as main', async () => {
  const now = await accepts(REPO);
  for (const k of Object.keys(MAIN.accepts)) assert.deepEqual(now[k], MAIN.accepts[k], k);
  // The stamped PR result of the repo's own (marked) quick-fix has main's bytes, so main's blob hash.
  const stampedMain = MAIN.accepts['quick-fix as in the repo'].find((e) => e.label === 'build: stamped');
  const stampedNow = now['quick-fix as in the repo'].find((e) => e.label === 'build: stamped');
  assert.equal(stampedNow.ret.accepted.hash, stampedMain.ret.accepted.hash);
  assert.deepEqual(Object.keys(JSON.parse(Object.values(stampedNow.blobs)[0]).pr), ['url', 'at', 'key', 'branch', 'checkout', 'gates', 'green']);
});

test('kinds-declare-stamps: REF_KINDS holds github-pr and web-page; STAMPED and HIDDEN are their union, as main\'s lists', async () => {
  const refs = await import(pathToFileURL(join(REPO, 'packages/engine/src/refs/index.js')).href);
  const stages = await import(pathToFileURL(join(REPO, 'packages/engine/src/stages.js')).href);
  assert.deepEqual(Object.keys(refs.REF_KINDS).sort(), ['github-pr', 'web-page']);
  const union = (part) => [...new Set(Object.values(refs.REF_KINDS).flatMap((k) => k[part]))];
  assert.deepEqual([...refs.STAMPED], union('stamps'));
  assert.deepEqual([...refs.HIDDEN], union('hidden'));
  assert.deepEqual([...refs.STAMPED], MAIN.stamped.STAMPED);
  assert.deepEqual([...refs.HIDDEN], MAIN.stamped.HIDDEN);
  assert.equal(stages.STAMPED, refs.STAMPED);
  assert.equal(stages.HIDDEN, refs.HIDDEN);
  for (const [name, k] of Object.entries(refs.REF_KINDS)) {
    assert.equal(k.kind, name);
    assert.equal(typeof k.check, 'function');
  }
});

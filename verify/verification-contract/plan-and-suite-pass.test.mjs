// Expect plan-and-suite-pass, the part a test can hold: the plan check passes on the head's real plan, and it does so
// with done items still holding the phrases decision 1 lists, so the exemption is what lets them pass. npm test at
// the head and the diff's file list are shown in the verdict's command and excerpt.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DECISION_PHRASES, REPO, headOf, node } from './lib.mjs';

test('node plan/check.mjs passes on the head plan', () => {
  const r = node([join(REPO, 'plan/check.mjs')]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /items/);
});

test('done items holding listed phrases exist and pass; no ready item holds one', () => {
  const dir = join(REPO, 'plan/items');
  const pinned = { done: 0, live: [] };
  for (const f of readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'README.md')) {
    let head; try { head = headOf(readFileSync(join(dir, f), 'utf8')); } catch { continue; }
    for (const e of head.expect ?? []) {
      const c = String(e.check ?? '').toLowerCase().replace(/’/g, "'");
      const hit = DECISION_PHRASES.some((p) => new RegExp(`(^|[^\\w'])${p.replace(/ /g, '\\s+')}($|[^\\w'])`).test(c));
      if (!hit) continue;
      if (head.status === 'done') pinned.done++;
      if (head.status === 'ready') pinned.live.push(`${head.id}/${e.id}`);
    }
  }
  assert.ok(pinned.done > 0, 'some done item still pins main');
  assert.deepEqual(pinned.live, []);
});

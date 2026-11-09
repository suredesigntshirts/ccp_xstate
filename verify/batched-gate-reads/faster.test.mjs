// faster: in a temp repo holding this checkout's plan/ and scripts/, the head's freeze gate runs in under 0.5 s and
// the base's in over 2 s; the stubs gate, over plan/, scripts/, packages/ and plugins/, takes under half the base's
// time. Each is the median of five alternating runs. The guards' CPU, base against head, is in evidence/faster.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { HEAD_GATE, baseGate, runGate, seededRepo } from './lib.mjs';

const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

function times(t, which, dirs) {
  const r = seededRepo(t, { dirs });
  r.write('plan/items/x.md', '```json\n{"id":"x","status":"ready","expect":[]}\n```\n');
  r.commit('pr\n\nClaude-Session: builder');
  const base = baseGate(t);
  const ms = { base: [], head: [] };
  for (let i = 0; i < 5; i++) {
    for (const [k, script] of [['base', base], ['head', HEAD_GATE]]) {
      const out = runGate(script, which, r);
      assert.equal(out.status, 0, out.stderr);
      ms[k].push(out.ms);
    }
  }
  const m = { base: median(ms.base), head: median(ms.head) };
  t.diagnostic(`${which}: base median ${m.base.toFixed(0)} ms, head median ${m.head.toFixed(0)} ms`);
  return m;
}

test('the freeze gate over the real plan: head under 0.5 s, base over 2 s', (t) => {
  const m = times(t, 'freeze', ['plan', 'scripts']);
  assert.ok(m.head < 500, `head ${m.head} ms`);
  assert.ok(m.base > 2000, `base ${m.base} ms`);
});

test('the stubs gate over plan/, scripts/, packages/ and plugins/: head under half the base', (t) => {
  const m = times(t, 'stubs', ['plan', 'scripts', 'packages', 'plugins']);
  assert.ok(m.head < m.base / 2, `head ${m.head} ms, base ${m.base} ms`);
});

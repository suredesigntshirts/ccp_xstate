// records-readable: every committed item journal's pin loads through loadWorkflow and replays through restore; the
// adopt trial's is the one retired, for its asking state without a timer.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import * as L from './lib.mjs';

const { index, host: H } = await L.engine();
const files = execFileSync('git', ['-C', L.REPO, 'ls-files', '*/items/*.jsonl'], { encoding: 'utf8' }).split('\n')
  .filter((f) => /\/items\/[^/]+\.jsonl$/.test(f));

test('every committed pin loads and every pinned journal replays; only the adopt trial\'s pin is retired', () => {
  const retired = [];
  let replayed = 0;
  const pins = new Set();
  for (const f of files) {
    const abs = join(L.REPO, f);
    const pin = L.pinOf(abs);
    if (!/@[0-9a-f]{64}$/.test(pin ?? '')) continue;
    const root = dirname(dirname(abs));
    const item = f.split('/').at(-1).replace(/\.jsonl$/, '');
    const spec = index.loadWorkflow(pin, { root });
    assert.equal(spec.id, pin);
    pins.add(pin);
    if (index.retiredOf(spec)) retired.push([f, pin, index.retiredOf(spec)]);
    const host = H.restore({ root, item, spec, session: 'verify', release: '9.9.9' });
    assert.equal(host.seq, L.applied(abs).length, f);
    replayed++;
  }
  console.log(`files ${files.length}, replayed ${replayed}, distinct pins ${pins.size}, retired ${retired.length}`);
  assert.ok(replayed >= 200);
  assert.deepEqual(retired.map(([f]) => f), ['tournaments/2026-11-04-stage-contract/trials/adopt/journal/items/trial.jsonl']);
  assert.match(retired[0][2], /state awaitingGates asks the person \(invoke ask\) and sets no timer/);
});

// Every committed journal replays on the workflow it pinned (plan item stage-bench, Expect edit-safe): an item's rows
// name `<workflow>@<sha256>`, the bytes are under the journal's blobs/, and restore() re-runs every applied transition
// on them and checks each hash. So editing workflows/*.json, a prompt rule for instance, never breaks a finished
// item's replay. A journal whose item names a workflow without pinning it (made before the pin) is listed, not replayed.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { restore } from '../packages/engine/src/host.js';
import { workflowOf } from '../packages/engine/src/index.js';

const REPO = new URL('..', import.meta.url).pathname;
const files = execFileSync('git', ['-C', REPO, 'ls-files', '*/items/*.jsonl'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);

const pinOf = (file) => {
  const first = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
    .find((r) => r.kind === 'engine.transition' && r.payload?.seq === 0 && r.payload?.outcome === 'applied');
  return first?.payload?.workflow ?? null;
};

test('committed journals exist, and the trial journals among them pin their workflow', () => {
  assert.ok(files.length >= 3);
  for (const t of ['adopt', 'fail', 'blocked']) {
    const f = files.find((x) => x.includes(`/trials/${t}/journal/items/`));
    assert.ok(f, t);
    assert.match(pinOf(join(REPO, f)), /^quick-fix@[0-9a-f]{64}$/, t);
  }
});

for (const file of files) {
  const abs = join(REPO, file);
  const root = dirname(dirname(abs));
  const item = file.split('/').at(-1).replace(/\.jsonl$/, '');
  const pin = pinOf(abs);
  const pinned = /@[0-9a-f]{64}$/.test(pin ?? '');
  if (!pinned) {
    // Made before the pin: it names a workflow by file name only, so there are no bytes to replay it on.
    test(`${file} names ${pin ?? 'no workflow'} without a pin: listed, not replayed`, () => assert.doesNotMatch(String(pin), /@/));
    continue;
  }
  test(`${file} replays on its pinned ${pin.slice(0, 22)}...`, () => {
    assert.ok(existsSync(join(root, 'blobs', pin.split('@')[1])), 'the pinned bytes are committed beside the journal');
    const spec = workflowOf(root, item);
    assert.equal(spec.id, pin);
    const host = restore({ root, item, spec, session: 'replay-test', release: '0.0.0' });
    assert.ok(host.seq > 0);
  });
}

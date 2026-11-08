// Expect release-paths-named-once: docs/gates.md and plan/README.md decide what is released only by pointing at
// RELEASED in scripts/release/release.mjs, and neither lists plugins/harness/ or packages/journal/ as released paths.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, section } from './lib.mjs';

const gates = read('docs/gates.md');
const readme = read('plan/README.md');
const released = read('scripts/release/release.mjs').match(/export const RELEASED = \[([^\]]*)\]/)[1];

test('RELEASED exists in scripts/release/release.mjs', (t) => {
  t.diagnostic(`RELEASED = [${released}]`);
  assert.match(released, /plugins\/harness/);
});

test('docs/gates.md, After the merge, points at RELEASED and the release command', (t) => {
  const after = section(gates, 'After the merge');
  t.diagnostic(after.trim().replace(/\n/g, ' '));
  assert.match(after, /`RELEASED`/);
  assert.match(after, /node scripts\/release\/release\.mjs branch --push/);
});

test('plan/README.md, step 4, points at the release command in docs/gates.md', (t) => {
  const step4 = readme.match(/^4\. \*\*Merge and release\.\*\*[\s\S]*?(?=\n\n)/m)[0];
  t.diagnostic(step4.replace(/\n/g, ' '));
  assert.match(step4, /release command \(`docs\/gates\.md`, "After the merge"\)/);
});

test('neither file lists plugins/harness/ or packages/journal/ as released paths', (t) => {
  for (const [name, text] of [['docs/gates.md', gates], ['plan/README.md', readme]]) {
    const hits = text.split('\n').filter((l) => /plugins\/harness\/(?!README\.md)|packages\/journal\//.test(l));
    t.diagnostic(`${name}: ${hits.length} lines naming plugins/harness/ (other than its README) or packages/journal/`);
    assert.deepEqual(hits, [], name);
  }
});

// selection-holds: a guard whose result a change can flip is in the selection. The guard here reads a recorded file
// under verify/ by a join() of quoted parts, the shape plugins/harness/test/finish-ms.test.mjs had when a PR deleted
// verify/probe-plugin-agents-thread/evidence/agent-adda18087b10e0b3a.jsonl and that guard went red in ci.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pick, tempRepo } from './lib.mjs';

const GUARD = 'plugins/p/test/reads-record.test.mjs';
const RECORD = 'verify/some-item/evidence/agent-1.jsonl';

function world(t) {
  const r = tempRepo(t);
  r.write('package.json', '{"name":"w","private":true}\n');
  r.write('plugins/p/scripts/x.mjs', 'export const x = 1;\n');
  r.write('plugins/p/test/other.test.mjs', "import { x } from '../scripts/x.mjs';\n");
  r.write(GUARD, [
    "import { readFileSync } from 'node:fs';",
    "import { join } from 'node:path';",
    "const PLUGIN = new URL('..', import.meta.url).pathname;",
    "readFileSync(join(PLUGIN, '..', '..', 'verify', 'some-item', 'evidence', 'agent-1.jsonl'), 'utf8');", '',
  ].join('\n'));
  r.write(RECORD, '{"ms":4944}\n');
  r.write('plan/items/some-item.md', 'an item\n');
  return { r, base: r.commit('base') };
}

const holds = (picked, file) => picked === 'ALL' || picked.includes(file);

test('selection-holds: changing a file a guard reads selects that guard', (t) => {
  const { r, base } = world(t);
  r.write(RECORD, '{"ms":1}\n');
  const picked = pick(base, r.commit('change'), r.dir);
  assert.ok(holds(picked, GUARD), `selected: ${picked}`);
});

test('selection-holds: deleting a file a guard reads selects that guard', (t) => {
  const { r, base } = world(t);
  r.remove(RECORD);
  const picked = pick(base, r.commit('delete'), r.dir);
  assert.ok(holds(picked, GUARD), `selected: ${JSON.stringify(picked)}`);
});

test('selection-holds: moving away a file a guard reads selects that guard', (t) => {
  const { r, base } = world(t);
  r.move(RECORD, 'verify/other-item/evidence/agent-1.jsonl');
  const picked = pick(base, r.commit('move'), r.dir);
  assert.ok(holds(picked, GUARD), `selected: ${JSON.stringify(picked)}`);
});

test('selection-holds: deleting a module a guard imports selects that guard', (t) => {
  const { r, base } = world(t);
  r.remove('plugins/p/scripts/x.mjs');
  const picked = pick(base, r.commit('delete module'), r.dir);
  assert.ok(holds(picked, 'plugins/p/test/other.test.mjs'), `selected: ${JSON.stringify(picked)}`);
});

test('selection-holds: a plan-only change selects neither guard', (t) => {
  const { r, base } = world(t);
  r.write('plan/items/some-item.md', 'an item, changed\n');
  assert.deepEqual(pick(base, r.commit('plan'), r.dir), []);
});

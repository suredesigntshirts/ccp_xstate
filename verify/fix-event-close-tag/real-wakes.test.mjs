// Expect: fix-event-close-tag/real-wakes-read
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restore, offer, loadWorkflow, inputsOfWake, wakesIn } from '../../packages/engine/src/index.js';

const dir = new URL('../../packages/engine/test/fixtures/wakes/', import.meta.url);
const files = [
  ...readdirSync(dir).filter((f) => f.endsWith('.txt')).map((f) => new URL(f, dir)),
  new URL('../../test/regression/fixtures/red-ci/delivered-wake.txt', import.meta.url)
];
// Each event the file itself writes: its kind and the JSON line under its <event> line.
const written = (text) => [...text.matchAll(/^\s*<event source="github" kind="([^"]+)"[^>]*>\n(?:\s*<!--.*-->\n)?\s*(\{.*\})\n\s*<\/event>$/gm)].map(([, kind, json]) => ({ kind, data: JSON.parse(json) }));

for (const file of files) {
  test(`${file.pathname.split('/').slice(-2).join('/')} reads as one wake with its written events parsed`, () => {
    const text = readFileSync(file, 'utf8');
    const wakes = wakesIn(text);
    assert.equal(wakes.length, 1);
    assert.deepEqual(wakes[0].github.map(({ kind, data }) => ({ kind, data })), written(text));
  });
}

test('every GitHub fixture has at least one event (the comparison is not vacuous)', () => {
  const n = files.map((f) => written(readFileSync(f, 'utf8')).length);
  assert.equal(n.filter((x) => x > 0).length, files.length - 1); // tap-wake has none
});

test('a one-line scheduled wake still fires a due timer', async () => {
  const fixtures = new URL('../../packages/engine/test/fixtures/workflows/', import.meta.url).pathname;
  const root = mkdtempSync(join(tmpdir(), 'v-fect-'));
  const h = restore({ root, item: 't-1', spec: loadWorkflow('timed', { root, dir: fixtures }), session: 'owner', release: '0.1.0' });
  await offer(h, [{ event: { type: 'xstate.init', input: { pr: 'https://github.com/o/r/pull/1' } }, source: { system: 'claude-code', ref: 'owner' } }], {});
  const [timer] = [...h.timers.values()];
  assert.ok(timer);
  const later = new Date(Date.parse(timer.due) + 60_000).toISOString();
  const line = `<wake reason="scheduled" current-time="${later}"></wake>`;
  assert.equal(wakesIn(line).length, 1);
  const fired = inputsOfWake(h, line, { now: later }).filter((i) => i.source.system === 'timer');
  assert.equal(fired.length, 1);
  const early = `<wake reason="scheduled" current-time="${new Date(Date.parse(timer.due) - 60_000).toISOString()}"></wake>`;
  assert.equal(inputsOfWake(h, early, { now: later }).filter((i) => i.source.system === 'timer').length, 0);
});

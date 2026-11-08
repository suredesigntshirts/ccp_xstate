// one-check: no pinned relaxation or pre-contract wording in packages/engine/src; loadWorkflow checks a pin as a name.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import * as L from './lib.mjs';

const SRC = join(L.REPO, 'packages/engine/src');
const walk = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : e.name.endsWith('.js') ? [join(d, e.name)] : []));
const files = walk(SRC).map((f) => ({ f: relative(L.REPO, f), text: readFileSync(f, 'utf8') }));

test('no source names the pinned option or workflows pinned before the stage contract or the asking timer', () => {
  const hits = [];
  for (const { f, text } of files) {
    text.split('\n').forEach((line, i) => {
      if (/pinned\s*[:=?]|pinned\s*\?|\{[^}]*\bpinned\b[^}]*\}\s*=|before the stage contract|before this contract|asking states|form before|pinned before/i.test(line)) hits.push(`${f}:${i + 1}: ${line.trim()}`);
    });
  }
  // Left: the pin's own form in index.js (PINNED and its match), not a check option; and marks.js's comment on the
  // unmarked reading (stages pinned before marks), which the item keeps as a non-goal (retire-unmarked-reading).
  const rest = hits.filter((h) => !/index\.js:\d+:\s*const (PINNED = |pinned = String\(name\)\.match\(PINNED\);)/.test(h)
    && !/marks\.js:\d+:.*pinned before marks/.test(h));
  assert.deepEqual(rest, []);
});

test('checkStages takes { workflows } only, and loadWorkflow calls it the same way for a pin and a name', () => {
  const stages = files.find((x) => x.f.endsWith('src/stages.js')).text;
  assert.match(stages, /export function checkStages\(spec, \{ workflows = null \} = \{\}\)/);
  const index = files.find((x) => x.f.endsWith('src/index.js')).text;
  const calls = [...index.matchAll(/checkStages\([^\n]*?(\{ workflows[^\n]*\})\)/g)].map((m) => m[1]);
  assert.equal(calls.length, 2, calls.join(' | '));
  assert.equal(calls[0], calls[1]);
  assert.equal(calls[0], '{ workflows: workflowNames(dir ?? REPO_WORKFLOWS) }');
  for (const { f, text } of files) assert.doesNotMatch(text, /checkStages\([^)]*pinned/, f);
});

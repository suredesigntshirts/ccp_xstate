// brief-one-meaning: the Expect line's grep finds only names.js's fallback and the v1 upcaster, and the only code that
// writes a brief.stored row is accept's per-role loop for the brief stage.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO } from './lib.mjs';

const DIRS = ['packages/engine/src', 'packages/journal/src', 'plugins/harness/scripts', 'scripts/inspector', 'scripts/bench'];
const SKIP = /(^|\/)(test|node_modules|vendor)(\/|$)/;
function files(dirs) {
  return dirs.flatMap((d) => readdirSync(join(REPO, d), { recursive: true }).map(String).map((f) => join(d, f)))
    .filter((f) => !SKIP.test(f)).filter((f) => { try { return readFileSync(join(REPO, f)) && !readdirSync(join(REPO, f)); } catch (e) { return e.code === 'ENOTDIR'; } });
}
const grep = (re, list) => list.flatMap((f) => readFileSync(join(REPO, f), 'utf8').split('\n').map((text, i) => ({ f, line: i + 1, text })).filter((l) => re.test(l.text)));

test('brief-one-meaning: brief.md, briefHash and briefOf appear only in promptFile and the v1 upcaster', (t) => {
  const hits = grep(/brief\.md|briefHash|briefOf/, files(DIRS));
  for (const h of hits) t.diagnostic(`${h.f}:${h.line}: ${h.text.trim()}`);
  const names = readFileSync(join(REPO, 'packages/engine/src/names.js'), 'utf8').split('\n');
  const jidx = readFileSync(join(REPO, 'packages/journal/src/index.js'), 'utf8').split('\n');
  // The enclosing function of each hit: promptFile in names.js, toV2 (UPCASTERS[1]) in the journal.
  const inFn = (lines, line, fn) => lines.slice(0, line).reverse().find((l) => /^(export )?function \w+/.test(l))?.match(/function (\w+)/)[1] === fn;
  const bad = hits.filter((h) => {
    if (h.f === 'packages/engine/src/names.js') return !(inFn(names, h.line, 'promptFile') || /^\s*\*/.test(h.text) && names.slice(h.line, h.line + 4).some((l) => /export function promptFile/.test(l)));
    if (h.f === 'packages/journal/src/index.js') return !(inFn(jidx, h.line, 'toV2') || /^\s*\*/.test(h.text) && jidx.slice(h.line, h.line + 8).some((l) => /^function toV2/.test(l)));
    return true;
  });
  assert.deepEqual(bad, []);
  assert.ok(hits.some((h) => h.f.endsWith('names.js') && /'brief\.md'/.test(h.text)), 'the fallback is there');
  assert.ok(hits.some((h) => h.f.endsWith('journal/src/index.js') && /briefHash/.test(h.text) && !/^\s*\*/.test(h.text)), 'the upcaster is there');
  assert.match(jidx.join('\n'), /UPCASTERS = Object\.freeze\(\{ 1: toV2 \}\)/);
});

test('brief-one-meaning: the only brief.stored writer is accept\'s per-role loop for the brief stage', (t) => {
  // Every file that could write a journal row: engine, plugin, journal, scripts, tournaments' drivers, excluding tests.
  const all = files(['packages', 'plugins', 'scripts']).filter((f) => /\.(m?js|cjs)$/.test(f));
  const writes = grep(/kind:\s*['"]brief\.stored['"]/, all);
  for (const w of writes) t.diagnostic(`${w.f}:${w.line}: ${w.text.trim().slice(0, 160)}`);
  assert.equal(writes.length, 1);
  assert.equal(writes[0].f, 'packages/engine/src/run/accept.js');
  const src = readFileSync(join(REPO, 'packages/engine/src/run/accept.js'), 'utf8').split('\n');
  const before = src.slice(writes[0].line - 6, writes[0].line).join('\n');
  assert.match(before, /if \(run\.actor === 'brief'\) \{\s*\n\s*for \(const \[role, brief\] of Object\.entries\(result\)\)/);
  const fn = src.slice(0, writes[0].line).reverse().find((l) => /^export (async )?function \w+/.test(l));
  assert.match(fn, /function accept\b/);
  // No other spelling (a variable kind, a computed string) builds the name anywhere else.
  const other = grep(/brief\.stored/, all).filter((h) => !(h.f === writes[0].f && h.line === writes[0].line))
    .filter((h) => !/^\s*(\/\/|\*)/.test(h.text));
  for (const o of other) t.diagnostic(`reads: ${o.f}:${o.line}: ${o.text.trim().slice(0, 160)}`);
  assert.ok(other.every((o) => /kinds\.js$|journal\/src\/index\.js$|inspector\/export\.mjs$/.test(o.f)), 'other mentions only list, upcast or read the kind');
});

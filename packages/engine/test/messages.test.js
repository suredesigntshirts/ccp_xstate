// prompt-catalogue: every text the harness hands a model is an entry of packages/engine/messages.md, rendered through
// mustache.js behind a strict wrapper (src/messages.js). These are the builder's tests; the verifier writes its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { catalogue, entries, load, parse, render, said, CATALOGUE } from '../src/messages.js';
import { render as renderRun, isStage } from '../src/stages.js';
import { cannotStart, stall, stopped, handback } from '../src/actors.js';
import { makeWorld, ISSUE, BRIEFS, builds, verifies } from './tourney/world.js';

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, '..', '..', '..');
const fence = (t) => `\`\`\`\n${t}\n\`\`\``;
const refused = (fn) => { try { fn(); } catch (error) { return error.message; } return null; };

test('the vendored mustache.mjs is the locked npm package\'s, byte for byte', () => {
  const lock = JSON.parse(readFileSync(join(repo, 'package-lock.json'), 'utf8'));
  const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8'));
  assert.equal(lock.packages['node_modules/mustache'].version, pkg.dependencies.mustache);
  const installed = join(repo, 'node_modules', 'mustache', 'mustache.mjs');
  assert.ok(existsSync(installed), 'npm ci installs mustache');
  assert.equal(readFileSync(join(here, '..', 'src', 'vendor', 'mustache.mjs'), 'utf8'), readFileSync(installed, 'utf8'));
});

test('the catalogue loads, and every entry is used by the engine or the plugin and every name the code renders exists', () => {
  const all = entries();
  assert.equal(load(CATALOGUE).entries.size, all.size);
  const sources = [
    ...readdirSync(join(here, '..', 'src'), { recursive: true }).filter((f) => f.endsWith('.js') && !f.startsWith('vendor')).map((f) => join(here, '..', 'src', f)),
    ...readdirSync(join(repo, 'plugins', 'harness', 'scripts')).filter((f) => f.endsWith('.mjs')).map((f) => join(repo, 'plugins', 'harness', 'scripts', f))
  ].map((f) => readFileSync(f, 'utf8')).join('\n');
  const named = new Set([...sources.matchAll(/\b(?:render|said|say)\('([a-z0-9-]+)'/g)].map((m) => m[1]));
  for (const name of named) assert.ok(all.has(name), `the code renders ${name}, which the catalogue lacks`);
  // Entries named through a table rather than a call: the part headings (stages.js HEADING_ENTRIES).
  for (const name of all.keys()) assert.ok(named.has(name) || sources.includes(`'${name}'`), `entry ${name} is used nowhere`);
});

test('a malformed catalogue is refused at load, naming the line', () => {
  const at = (text) => refused(() => parse(text, 'm.md'));
  assert.equal(at(`## a\n${fence('x')}\n\n## a\n${fence('y')}\n`), 'm.md:6: entry a is a duplicate of line 1');
  assert.equal(at(`## a\n${fence('')}\n`), 'm.md:2: entry a is empty');
  assert.equal(at(`## a\n${fence('  \n ')}\n`), 'm.md:2: entry a is empty');
  assert.match(at(`## a\nnote\n## b\n${fence('x')}\n`), /^m\.md:3: entry a has no template/);
  assert.match(at(`## a\n\`\`\`\nx\n`), /^m\.md:2: entry a's template is not closed/);
  assert.match(at(`## a\n${fence('x')}\nstray\n`), /^m\.md:5: text outside an entry/);
  assert.match(at(`## Not_Kebab\n${fence('x')}\n`), /^m\.md:1: entry name "Not_Kebab" is not kebab-case/);
  assert.match(at(`# title\n\npreamble ## not a heading\n\n## ok\n${fence('x')}\n`) ?? 'loaded', /^loaded$/);
});

test('a template with any tag but a plain slot is refused at load, naming the entry and its line', () => {
  const at = (body) => refused(() => parse(`## e\nnote\n${fence(body)}\n`, 'm.md'));
  assert.match(at('{{#x}}y{{/x}}'), /^m\.md:4: entry e uses a section/);
  assert.match(at('a\n{{^x}}y{{/x}}'), /^m\.md:5: entry e uses an inverted section/);
  assert.match(at('{{> part}}'), /^m\.md:4: entry e uses a partial/);
  assert.match(at('{{! note}}'), /^m\.md:4: entry e uses a comment/);
  assert.match(at('{{=<% %>=}}'), /^m\.md:4: entry e uses a delimiter change/);
  assert.match(at('{{{raw}}}'), /^m\.md:4: entry e uses an unescaped variable/);
  assert.match(at('{{a.b}}'), /^m\.md:4: entry e has slot \{\{a\.b\}\}/);
  assert.match(at('{{open'), /^m\.md:4: entry e: Unclosed tag/);
});

test('a render gives exactly the entry\'s slots, as text or numbers, and escapes nothing', () => {
  const c = catalogue(`## e\n${fence('{{a}} and {{b}}; {{a}}')}\n`, 'm.md');
  assert.deepEqual(c.entries.get('e').slots, ['a', 'b']);
  assert.equal(c.render('e', { a: '<x & "y">', b: 2 }), '<x & "y"> and 2; <x & "y">');
  assert.equal(refused(() => c.render('e', { a: 'x' })), 'message e: no value for {{b}}');
  assert.equal(refused(() => c.render('e', { a: 'x', b: 'y', c: 'z' })), 'message e: no slot for c');
  assert.equal(refused(() => c.render('e', { a: null, b: 'y' })), 'message e: {{a}} is null, not text or a number');
  assert.equal(refused(() => c.render('e', { a: {}, b: 'y' })), 'message e: {{a}} is object, not text or a number');
  assert.equal(refused(() => c.render('e', { a: NaN, b: 'y' })), 'message e: {{a}} is number, not text or a number');
  assert.match(refused(() => c.render('nope')), /^no message entry "nope"/);
  assert.equal(c.render('e', { a: '{{b}}', b: 'y' }), '{{b}} and y; {{b}}', 'a value is never read as a template');
  assert.deepEqual(c.said('e', { a: 'x', b: 1 }), { text: 'x and 1; x', message: { entry: 'e', slots: { a: 'x', b: 1 } } });
});

test('a template is kept byte for byte: leading ## lines, blank lines and trailing spaces', () => {
  const c = catalogue(`## e\n${fence('## Rules\n\n  {{x}} \n')}\n`);
  assert.equal(c.render('e', { x: 'y' }), '## Rules\n\n  y \n');
});

test('every committed run folder still renders its brief.md', () => {
  const files = execFileSync('git', ['-C', repo, 'ls-files', '*brief.md'], { encoding: 'utf8' }).trim().split('\n');
  let rendered = 0;
  for (const f of files) {
    const dir = join(repo, dirname(f));
    if (!existsSync(join(dir, 'run.json'))) continue;
    const run = JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8'));
    if (!isStage(run.schema)) continue;
    assert.equal(renderRun(run), readFileSync(join(repo, f), 'utf8'), f);
    rendered++;
  }
  assert.ok(rendered >= 100, `rendered ${rendered}`);
});

test('the rows of a refusal, a send-back, a no-return and a stall carry the entry and slots that give their text', async () => {
  const w = await makeWorld();
  try {
    await w.start('m', 'quick-fix', { issue: ISSUE });
    await w.agent('m', 'brief', () => BRIEFS); await w.drive('m');
    // A schema refusal, then a covers refusal of the verify stage.
    const bad = await w.agent('m', 'build', () => ({ pr: { url: 'prose', at: 'a'.repeat(40) } }), 'ag-b');
    assert.equal(bad.refused.rule, 'schema');
    await w.agent('m', 'build', builds(w, 1), 'ag-b'); await w.drive('m');
    const gap = await w.agent('m', 'verify', async (a) => ({ ...(await verifies(w)(a)), lines: [{ line: 'another', result: 'PASS', evidence: 'e' }] }), 'ag-v');
    assert.equal(gap.refused.rule, 'covers');
    // The verify agent stops twice without returning: sent back, then the run fails.
    assert.ok(stopped({ root: w.root, agentId: 'ag-v' }).block);
    assert.ok(stopped({ root: w.root, agentId: 'ag-v' }).failed);
    const rows = w.rows('m').filter((r) => r.kind === 'refusal');
    const kinds = rows.map((r) => r.payload.rule);
    for (const rule of ['schema', 'covers', 'sent-back', 'no-return']) assert.ok(kinds.includes(rule), `${rule} in ${kinds}`);
    for (const r of rows) {
      assert.ok(r.payload.message?.entry, `${r.payload.rule} row names its entry`);
      assert.equal(render(r.payload.message.entry, r.payload.message.slots), r.payload.reason, `${r.payload.rule} row`);
    }
    assert.equal(rows.find((r) => r.payload.rule === 'sent-back').payload.message.entry, 'return-line');
  } finally { await w.close(); }
});

test('a stall, its cap and a cannot-start record their entries', async () => {
  const w = await makeWorld();
  try {
    await w.start('s', 'quick-fix', { issue: ISSUE });
    const owners = [w.session];
    const first = stall({ root: w.root, sessions: owners });
    assert.ok(first.block);
    stall({ root: w.root, sessions: owners });
    const capped = stall({ root: w.root, sessions: owners });
    assert.equal(capped.failed.length, 1);
    const rows = w.rows('s').filter((r) => r.kind === 'refusal');
    assert.deepEqual(rows.map((r) => r.payload.message.entry), ['stall', 'stall', 'stall-cap']);
    for (const r of rows) assert.equal(render(r.payload.message.entry, r.payload.message.slots), r.payload.reason);
    assert.equal(rows[0].payload.reason, first.block);
  } finally { await w.close(); }
  const v = await makeWorld();
  try {
    await v.start('c', 'quick-fix', { issue: ISSUE });
    const run = v.openRun('c', 'brief');
    const no = cannotStart({ root: v.root, prompt: `ccp-cannot-start ${run.id}: no Agent tool here`, sessions: [v.session] });
    assert.equal(no.deny, render('cannot-start-done', { run: run.id }));
    const row = v.rows('c').filter((r) => r.kind === 'refusal').at(-1);
    assert.deepEqual(row.payload.message, { entry: 'cannot-start-reason', slots: { why: 'no Agent tool here' } });
    assert.equal(row.payload.reason, 'cannot-start: no Agent tool here');
  } finally { await v.close(); }
});

test('a handback with the run open is sent back with the return line inside its entry', async () => {
  const w = await makeWorld();
  try {
    await w.start('h', 'quick-fix', { issue: ISSUE });
    const bad = await w.agent('h', 'brief', () => ({}), 'ag-h');
    assert.ok(bad.refused);
    const run = w.openRun('h', 'brief');
    const first = handback({ root: w.root, agentId: 'ag-h' });
    const row = w.rows('h').filter((r) => r.kind === 'refusal').at(-1);
    assert.equal(row.payload.message.entry, 'sent-back-handback');
    assert.equal(first.deny, said('sent-back-handback', { returnLine: render('return-line', { run: run.id }) }).text);
  } finally { await w.close(); }
});

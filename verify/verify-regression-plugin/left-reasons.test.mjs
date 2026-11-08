// left-reasons-hold: each left test, and each left half of a split, read at the base, is of a kind the item lets
// leave: it matched source or doc text, compared output with a capture stored under verify/ (main's answers), asserted
// facts of a recorded past run or input without running head code on it, or ran only against a retired path. The
// line fails only for a left test that drives head code and asserts what came back with no stored capture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, REPO, haveCommits, regressionTable, show } from './lib.mjs';

/** Code with string, template and regex literals blanked, so a name inside a literal is not a call. */
const bare = (b) => b.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''").replace(/([(,=!&|:]\s*)\/(?:\\.|\[(?:\\.|[^\]])*\]|[^/\n\\])+\/[gimsuy]*/g, '$1/x/');

/** Suite helpers that only read text or pick fields: no head code runs through them. */
const READERS = new Set(['outputLine', 'textOf', 'tempDir']);
/**
 * The names a base test file can run head code through: what it imports from packages/, plugins/ or scripts/, the
 * functions it takes from its suite's lib.mjs or scenarios.mjs (constants in capitals and plain readers aside), and
 * child processes.
 */
function drivers(file) {
  const names = new Set(['spawnSync', 'execFileSync', 'execFile', 'spawn', 'stop']);
  const take = (list, sep) => { for (const p of list.split(',')) { const n = p.trim().split(sep).pop().trim(); if (n && !/^[A-Z_0-9]+$/.test(n) && !READERS.has(n)) names.add(n); } };
  for (const m of file.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) if (/(packages|plugins|scripts)\/|^\.\/(lib|scenarios)\.mjs$/.test(m[2])) take(m[1], /\s+as\s+/);
  for (const m of file.matchAll(/const\s*\{([^}]*)\}\s*=\s*await\s+import\(([^)]*)\)/g)) if (/(packages|plugins|scripts)\//.test(m[2])) take(m[1], /\s*:\s*/);
  return [...names];
}
const calls = (body, names) => names.filter((n) => new RegExp(`(?<![\\w$])${n.replace('$', '\\$')}\\s*\\(`).test(bare(body)));
const drives = (b, f) => calls(b, drivers(f)).filter((n) => n !== 'time'); // the verifier's own wall clock in obs-page

/** The kinds a left test may be; each takes the test's body and its whole base file. */
const KINDS = {
  // compares with a capture of main, or of an earlier run's output, stored under the suite's folder
  capture: (b, f) => /main-[a-z-]+\.json|['"]main['"],\s*['"]answers\.json|main\/answers\.json|published-index\.html|browser-check[-a-z0-9]*\.json|evidence', 'real'/.test(f) &&
    /\b(main|MAIN|recorded|want|ev|pub|shown|finish)\b/.test(bare(b).replace(/''/g, '')),
  // asserts facts of recorded rows, transcripts or page output, and runs no head code
  recorded: (b, f) => /['"](evidence|fixtures?)['"]|\/(evidence|fixtures?)\b|\bfx\(/.test(f) && drives(b, f).length === 0,
  // reads source or doc text and matches it, and runs no head code
  source: (b, f) => /readFileSync\(join\(REPO, '(docs|packages|plugins|scripts)|join\(REPO, 'scripts\/inspector'\)|readFileSync\(\s*join\(REPO, f\)/.test(f) && drives(b, f).length === 0,
  // runs only with a journal or lane checkout at a retired path, or only on a checkout of main
  // the same assertion on the same code is held by a test outside verify/ that npm test runs (the row names it), and
  // could not hold under the regression set's parallel runs: checked against that test at the head
  heldElsewhere: (b) => /hook\.run/.test(b) && /bare/.test(b) && /<= 50/.test(b) &&
    /test\('cheap: hook\.run rows show at most 50 ms median and 200 ms p95 over a bare node start/.test(readFileSync(join(REPO, 'plugins/harness/test/capture.test.mjs'), 'utf8')) &&
    /plugins\/harness\/test\/capture\.test\.mjs/.test(regressionTable().find((r) => r.file === 'verify/obs-live-capture/capture.test.mjs').reason),
  retired: (b, f) => (/\{ skip[,}]|skip: wfFiles\.length/.test(b) && /\/home\/user\/lanes|skipReason/.test(f)) || /skip: !process\.env\.VERIFY_MAIN/.test(b)
};

/** [file under verify/, title pattern or null for every test in the file, kind, what shows it]. */
const LEFT = [
  ['fix-agent-finish-ms/real-agents.test.mjs', /^real-agents run/, 'recorded', 'the recorded runs\' journals'],
  ['fix-agent-finish-ms/real-agents.test.mjs', /head\\'s hook over their timelines/, 'capture', 'the hook\'s ms against the ms journalled in that run'],
  ['fix-agent-finish-ms/unchanged.test.mjs', null, 'capture', 'evidence/main-scenarios.json'],
  ['fix-agent-finish-ms/old-entry.test.mjs', /^old-entry: main/, 'capture', 'evidence/main-scenarios.json'],
  ['fix-refusal-hints/real-agent.test.mjs', null, 'recorded', 'recorded agent transcripts and journals'],
  ['fix-refusal-hints/unchanged.test.mjs', null, 'capture', 'evidence/main-prompts.json'],
  ['fix-return-tool-answer/real-agent.test.mjs', null, 'recorded', 'a recorded agent transcript and journal'],
  ['fix-return-tool-answer/unchanged.test.mjs', null, 'capture', 'captures of main'],
  ['fix-return-tool-answer/stamped.test.mjs', /^stamped-accepted: on main the same/, 'capture', 'main\'s committed answers'],
  ['fix-return-tool-answer/stamped.test.mjs', /^stamped-accepted: on main, live/, 'retired', 'only on a checkout of main named by VERIFY_MAIN'],
  ['fix-waiting-lines-owner/real-session.test.mjs', null, 'recorded', 'a recorded headless session'],
  ['fix-waiting-lines-owner/unchanged.test.mjs', null, 'capture', 'main-prompts.json and main-scenarios.json'],
  ['fix-waiting-lines-owner/lines.test.mjs', /^lines-owned: on main/, 'capture', 'evidence/main-scenarios.json'],
  ['fix-waiting-lines-owner/stall.test.mjs', /rows and run files they leave/, 'capture', 'evidence/main-scenarios.json'],
  ['fix-waiting-lines-owner/stall.test.mjs', /Stop hook \(and cannot-start/, 'capture', 'evidence/main-scenarios.json'],
  ['fix-waiting-run-stall/real-session.test.mjs', null, 'recorded', 'two recorded headless sessions'],
  ['fix-waiting-run-stall/unchanged.test.mjs', null, 'capture', 'evidence/main-prompts.json'],
  ['fix-refusal-hints/hint.test.mjs', null, 'capture', 'evidence/main-refusals.json (the refused half)'],
  ['harness-glossary/glossary.test.mjs', null, 'source', 'docs/language.md and source'],
  ['harness-glossary/notes.test.mjs', null, 'source', 'scripts/inspector/export.mjs'],
  ['harness-glossary/one-meaning.test.mjs', null, 'source', 'engine, journal and plugin source'],
  ['harness-glossary/capture.test.mjs', /carry what main/, 'capture', 'evidence/main/answers.json'],
  ['harness-glossary/capture.test.mjs', /every other row is the same/, 'capture', 'evidence/main/answers.json'],
  ['harness-glossary/capture.test.mjs', /capture-rows\.mjs names neither/, 'source', 'capture-rows.mjs source'],
  ['harness-glossary/prompt.test.mjs', /prompt\.md at the head is main/, 'capture', 'evidence/main/answers.json'],
  ['harness-glossary/v1.test.mjs', /same prepared and blocked counts as main/, 'capture', 'evidence/main/answers.json'],
  ['engine-item-views/item-views.test.mjs', /^fixture is the real run/, 'recorded', 'the recorded rows'],
  ['engine-item-views/world.test.mjs', /^tagged:/, 'recorded', 'the recorded iv1 journal'],
  ['engine-item-views/world.test.mjs', /^view: the page/, 'capture', 'the page\'s recorded browser-check output'],
  ['inspector-reads-records/no-guessing.test.mjs', /^none of the deleted functions/, 'source', 'scripts/inspector source'],
  ['inspector-reads-records/no-guessing.test.mjs', /^no engine source is read as text/, 'source', 'scripts/inspector source'],
  ['obs-journal-vs-world/journal-check.test.mjs', /^fixture sanity/, 'recorded', 'the recorded inputs'],
  ['obs-live-capture/capture.test.mjs', /^fixture sanity/, 'recorded', 'the recorded hook inputs'],
  ['obs-live-capture/capture.test.mjs', /^cheap \(fixture run\)/, 'heldElsewhere', 'plugins/harness/test/capture.test.mjs cheap'],
  ['obs-page/live.test.mjs', /^(the copied journal|real journal copy|journal with the builder)/, 'recorded', 'a journal copy and the page\'s recorded browser-check output'],
  ['obs-page/live.test.mjs', /^the published page/, 'capture', 'a stored published page'],
  ['obs-person-attention/person.test.mjs', /^fixture sanity/, 'recorded', 'the recorded wake'],
  ['obs-person-attention/rows-real.test.mjs', /^fixture:/, 'recorded', 'the recorded counts'],
  ['obs-refusal-log/refusal.test.mjs', /^the fixture really holds/, 'recorded', 'the probe\'s recorded event'],
  ['workflow-inspector/generic.test.mjs', /^generic: scripts\/inspector\/ code names/, 'source', 'scripts/inspector source'],
  ['workflow-inspector/generic.test.mjs', /^generic: the (exporter|page)/, 'retired', '/home/user/lanes checkouts'],
  ['workflow-inspector/true-to-disk.test.mjs', null, 'retired', '/mnt/project-files journal and /home/user/lanes'],
  ['workflow-inspector/usable.test.mjs', null, 'retired', 'the same retired journal and lanes']
];

/** [title, body] of every top-level test in a file. */
function testsOf(text) {
  const starts = [...text.matchAll(/^\s*test\((['"`])((?:\\.|(?!\1).)*)\1/gm)];
  return starts.map((m, i) => [m[2], text.slice(m.index, starts[i + 1]?.index ?? text.length)]);
}

test('left-reasons-hold: every left file and split row the table names has a case here', () => {
  const rows = regressionTable().filter((r) => r.verdict !== 'moved').map((r) => r.file.replace(/^verify\//, ''));
  const cased = new Set(LEFT.map(([f]) => f));
  assert.deepEqual(rows.filter((f) => !cased.has(f) && !regressionTable().find((r) => r.file === `verify/${f}`).verdict.startsWith('split')), []);
  // a split row needs a case only for its left half; every split row with a left half has one
  for (const r of regressionTable().filter((x) => x.verdict === 'split')) assert.ok(cased.has(r.file.replace(/^verify\//, '')), `${r.file}: its left half has a case`);
});

test('left-reasons-hold: every test of a whole-file left row has a case', (t) => {
  if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
  for (const r of regressionTable().filter((x) => x.verdict === 'left')) {
    const f = r.file.replace(/^verify\//, '');
    const cases = LEFT.filter(([x]) => x === f);
    for (const [title] of testsOf(show(BASE, r.file))) assert.ok(cases.some(([, re]) => !re || re.test(title)), `${f}: "${title}" has a case`);
  }
});

for (const [file, title, kind, why] of LEFT) {
  test(`left-reasons-hold: ${file}${title ? ` ${title}` : ''} is ${kind} (${why})`, (t) => {
    if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
    const text = show(BASE, `verify/${file}`);
    const picked = testsOf(text).filter(([name]) => !title || title.test(name));
    assert.ok(picked.length >= 1, `${file}: a test matches ${title}`);
    for (const [name, body] of picked) assert.ok(KINDS[kind](body, text), `${file}: "${name}" is ${kind}`);
  });
}

test('left-reasons-hold: the kinds refuse a moved test that drives the hook and asserts what came back (control)', (t) => {
  if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
  const text = show(BASE, 'verify/fix-waiting-run-stall/block.test.mjs');
  for (const [name, body] of testsOf(text)) {
    assert.ok(!KINDS.recorded(body, text) && !KINDS.source(body, text) && !KINDS.retired(body, text) && !KINDS.heldElsewhere(body), `block: "${name}" is no left kind`);
  }
});

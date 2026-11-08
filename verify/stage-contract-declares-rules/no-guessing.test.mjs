// no-guessing: outside packages/engine/src/marks.js, no engine source decides what to store by a stage's name, finds
// or judges a verdict by the words PASS or FAIL, or chooses a ref's check by its url; accept holds no GitHub or web
// policy; STAMPED and HIDDEN come from refs/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { REPO } from './lib.mjs';

const SRC = join(REPO, 'packages/engine/src');
const walk = (d) => readdirSync(d).flatMap((n) => (statSync(join(d, n)).isDirectory() ? walk(join(d, n)) : n.endsWith('.js') ? [join(d, n)] : []));
// Code lines only: comment lines and the text inside template and quoted strings that are messages are kept, since a
// comparison is code; a line that is all comment is dropped.
const code = (f) => readFileSync(f, 'utf8').split('\n').map((text, i) => ({ f: relative(REPO, f), line: i + 1, text })).filter(({ text }) => !/^\s*(\/\/|\*|\/\*\*)/.test(text));
const LINES = walk(SRC).filter((f) => !f.endsWith('/marks.js')).flatMap(code);
const hits = (re) => LINES.filter(({ text }) => re.test(text)).map(({ f, line, text }) => `${f}:${line}: ${text.trim()}`);

test('no-guessing: nothing outside marks.js compares a stage name with brief (or names any stage) to decide what to store', () => {
  assert.deepEqual(hits(/['"`]brief['"`]/), []);
  assert.deepEqual(hits(/\b(actor|src|stage|name)\s*[!=]==?\s*['"`](brief|build|verify|researcher|write|shape|challenge)['"`]/), []);
  const accept = readFileSync(join(SRC, 'run/accept.js'), 'utf8');
  assert.match(accept, /for \(const \[role, brief\] of marks\.briefs\(result\)\)/);
  assert.doesNotMatch(accept, /run\.actor\s*===/);
});

test('no-guessing: nothing outside marks.js tests a value or enum against PASS or FAIL in any case', () => {
  // The words appear only inside refusal texts for an unmarked stage (stages.js), never in a comparison or regexp.
  const words = hits(/pass|fail/i).filter((h) => /PASS|FAIL|\/\^?\(?pass|['"`]pass['"`]|['"`]fail['"`]/i.test(h.replace(/failed|failure|fails?\b|passes|passed|password|failUnstarted|failing/gi, '')));
  for (const h of words) assert.match(h, /^packages\/engine\/src\/stages\.js:\d+: .*marks\.inferred \? '(may say PASS or FAIL|PASS\/FAIL word)'/, h);
  assert.deepEqual(hits(/toUpperCase\(\)\s*===\s*['"]PASS|\/\^\(pass\|fail\)\$\/i/i), []);
  const stages = readFileSync(join(SRC, 'stages.js'), 'utf8');
  for (const gone of ['const WORD', 'isWord', 'function verdictAt']) assert.ok(!stages.includes(gone), `stages.js has no ${gone}`);
});

test('no-guessing: no source outside marks.js calls prRef to choose how a returned ref is checked', () => {
  const calls = hits(/\bprRef\(/);
  // refs/github-pr.js parses its own PR url; worktree.js parses the previous PR's url for a rebuild; actors.js reads an
  // input (the item's non-goal); merge.js defines it and its merge effect reads its input.
  for (const h of calls) assert.match(h, /^packages\/engine\/src\/(refs\/github-pr\.js|run\/worktree\.js|actors\.js|effects\/merge\.js):/, h);
  const accept = readFileSync(join(SRC, 'run/accept.js'), 'utf8');
  assert.doesNotMatch(accept, /prRef/);
});

test('no-guessing: accept imports nothing from effects/ and holds no GitHub or web-page policy', () => {
  const accept = readFileSync(join(SRC, 'run/accept.js'), 'utf8');
  const imports = [...accept.matchAll(/^import .* from '([^']+)'/gm)].map((m) => m[1]);
  assert.ok(!imports.some((p) => p.includes('effects/')), imports.join(', '));
  for (const policy of [/github\.(pull|files|suites)\(/, /web\.get\(/, /FILES_PAGE/, /GREEN/, /check_suites/, /\.github\//, /pull\/\$\{/]) assert.doesNotMatch(accept, policy);
  // The kind's checker runs; its stamp is set.
  assert.match(accept, /REF_KINDS\[marks\.kindOf\(/);
  assert.match(accept, /kind\.check\(ref,/);
});

test('no-guessing: STAMPED and HIDDEN in stages.js come from refs/index.js', () => {
  const stages = readFileSync(join(SRC, 'stages.js'), 'utf8');
  assert.match(stages, /^import \{[^}]*\bHIDDEN\b[^}]*\bSTAMPED\b[^}]*\} from '\.\/refs\/index\.js';$/m);
  assert.match(stages, /^export \{ HIDDEN, STAMPED \};$/m);
  assert.doesNotMatch(stages, /(const|let) (STAMPED|HIDDEN)\b/);
});

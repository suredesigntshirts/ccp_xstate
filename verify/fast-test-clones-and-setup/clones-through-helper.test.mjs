// clones-through-helper: no test file under test/, scripts/, packages/ or plugins/ makes a working clone of the repo,
// or of a bare clone of it, except through the helper; clones of small temp repos a test builds itself may stay plain.
// Every git clone call in the four trees is read and its source followed: the helper's own call, a bare clone (no
// working tree), or a source the same file builds with git init. Each plain clone's source is named below with the
// text in its file that builds it, so a new plain clone of the repo has no entry and fails here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { codeFiles, read } from './lib.mjs';

/** A git invocation whose arguments hold `clone`. */
const GIT_CLONE = /(?:execFileSync|spawnSync|spawn|execSync)\(\s*'git',\s*\[([^\]]*'clone'[^\]]*)\]|\bgit\('clone'([^)]*)\)|\bgit clone\b/;

/** file -> source expression -> the text in that file that makes the source a temp repo the test built. */
const TEMP_SOURCES = {
  'test/setup-release.test.mjs': { "git(cwd, 'remote', 'get-url', 'origin')": /'init', '-q', '-b', 'main', '--bare', origin\]/ },
  'test/regression/engine/rebuild-on-branch.test.mjs': { origin: /'init', '-q', '--bare', '-b', 'main', origin\]/ },
  'test/regression/engine/blocked-retry.test.mjs': { origin: /'init', '-q', '--bare', '-b', 'main', origin\]/ },
  'test/regression/engine/standin-grants.test.mjs': { origin: /'init', '-q', '--bare', '-b', 'main', origin\]/ },
  'packages/engine/test/actors.test.js': { 'fetched.origin': /const origin = mkdtempSync\([^\n]*\n\s*execFileSync\('git', \['init', '-q', '--bare'/ },
  // The bench's case repos: a seed folder made a one-commit repo, or a public repo's bare cache; never this repo.
  'scripts/bench/lib.mjs': { cache: /const cache = join\(tmpdir\(\), 'bench-cache'/ },
};

/** Each git clone call: { file, line, args } with the quoted and bare arguments, in order. */
function sites() {
  const out = [];
  for (const file of codeFiles()) {
    read(file).split('\n').forEach((text, i) => {
      if (/^\s*(\/\/|\*)/.test(text)) return;
      const m = text.match(GIT_CLONE);
      if (!m) return;
      const raw = m[1] ?? m[2] ?? '';
      out.push({ file, line: i + 1, text: text.trim(), args: splitArgs(raw) });
    });
  }
  return out;
}

/** Splits a JS argument list on top-level commas. */
function splitArgs(s) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of s) {
    if ('([{'.includes(ch)) depth++;
    if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

test('clones-through-helper: every git clone in the four trees is the helper, a bare clone, or of a temp repo its file builds', (t) => {
  const all = sites();
  assert.ok(all.length >= 8, `git clone calls found (${all.length})`);
  const seen = { helper: 0, bare: 0, temp: 0 };
  const bad = [];
  for (const s of all) {
    if (s.file === 'test/regression/lib.mjs' && /leanClone/.test(read(s.file).split('\n').slice(0, s.line).reverse().find((l) => /^export function/.test(l)) ?? '')) { seen.helper++; continue; }
    if (s.args.includes("'--bare'")) { seen.bare++; continue; }
    const positional = s.args.filter((a) => !/^'-/.test(a) && a !== "'clone'" && !/^\.\.\./.test(a));
    const src = positional[positional.length - 2];
    const why = TEMP_SOURCES[s.file]?.[src];
    if (why && why.test(read(s.file))) { seen.temp++; continue; }
    bad.push(`${s.file}:${s.line} clones ${src}: ${s.text}`);
  }
  t.diagnostic(`${all.length} git clone calls: ${seen.helper} the helper's, ${seen.bare} bare, ${seen.temp} of temp repos`);
  assert.deepEqual(bad, [], 'plain working clones whose source is not a temp repo the file builds');
});

test('clones-through-helper: every leanClone call takes the repo, a bare clone of it, or a clone source the file names', (t) => {
  const calls = codeFiles().flatMap((file) => [...read(file).matchAll(/\bleanClone\(([^,]+),/g)].map((m) => ({ file, src: m[1].trim() })))
    .filter((c) => !(c.file === 'test/regression/lib.mjs' && c.src === 'src'));
  t.diagnostic(calls.map((c) => `${c.file} <- ${c.src}`).join('; '));
  assert.ok(calls.length >= 6, `leanClone calls (${calls.length})`);
  for (const c of calls) assert.match(c.src, /^(REPO|ROOT|origin|w\.origin)$/, `${c.file}: ${c.src}`);
});

test('clones-through-helper: the controls hold, a plain clone of REPO would be refused and a bare one passed', () => {
  const m = "  execFileSync('git', ['clone', '-q', REPO, clone]);".match(GIT_CLONE);
  const args = splitArgs(m[1]);
  assert.equal(args.filter((a) => !/^'-/.test(a) && a !== "'clone'").at(-2), 'REPO');
  assert.ok(!TEMP_SOURCES['test/setup.test.mjs'], 'no temp source entry for the repo itself');
  assert.ok(splitArgs("'clone', '-q', '--bare', REPO, origin").includes("'--bare'"));
});

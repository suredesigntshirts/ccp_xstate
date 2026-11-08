// left-reasons-hold: each left test, and each left half of a split, read at the base, is of a kind the item lets
// leave: it read source or doc text and matched it, read its own PR's file list, asserted facts of recorded data with
// no head code run on it, compared output with a stored capture, ran a path this PR retires (a deleted verifier suite,
// an earlier commit's code), or held an assertion a test npm test runs already holds. The line fails only for a left
// test that drives head code and asserts what came back with no stored capture.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, REPO, gitDir, lsTree, regressionTable, show, walk } from './lib.mjs';

/** Code with comments and string, template and regex literals blanked, so a name inside a literal is not a call. */
const bare = (b) => b.replace(/\/\/[^\n]*/g, '').replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''")
  .replace(/([(,=!&|:]\s*)\/(?:\\.|\[(?:\\.|[^\]])*\]|[^/\n\\])+\/[gimsuy]*/g, '$1/x/');

/** The suite's helper files at the base, keyed by the specifier a test imports them with. */
const helpersOf = (folder) => Object.fromEntries(lsTree(BASE, `verify/${folder}`).filter((p) => /\.mjs$/.test(p) && !/\.test\.mjs$/.test(p))
  .map((p) => [`./${p.split('/').slice(2).join('/')}`, show(BASE, p)]));

// Runs head code: node on a file, an import of the harness, or a gate or plan check named in a string.
const RUNS = /process\.execPath|['"]node['"]|\bimport\(|from\s+['"][./]*(packages|plugins|scripts|plan)\//;

/** Each exported name of a helper text and the text of its definition, up to the next export. */
function regions(lib) {
  const at = [...lib.matchAll(/^export\s+(?:async\s+)?(?:function\*?\s+|const\s+|let\s+)([A-Za-z_$][\w$]*)/gm)];
  return at.map((m, i) => [m[1], lib.slice(m.index, at[i + 1]?.index ?? lib.length)]);
}

/**
 * The names a base test can run head code through: what it imports from packages/, plugins/, scripts/ or plan/, and
 * each function its suite's helpers export whose text runs node, imports harness code or calls such a function.
 */
function drivers(file, folder) {
  const names = new Set();
  const helpers = Object.values(helpersOf(folder));
  const defs = helpers.flatMap(regions);
  const runs = new Set(defs.filter(([, t]) => RUNS.test(t)).map(([n]) => n));
  for (const lib of helpers) for (const m of lib.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) if (/(packages|plugins|scripts|plan)\//.test(m[2])) for (const p of m[1].split(',')) runs.add(p.trim().split(/\s+as\s+/).pop().trim());
  for (let grew = true; grew;) {
    grew = false;
    for (const [n, t] of defs) if (!runs.has(n) && [...runs].some((r) => new RegExp(`(?<![\\w$.])${r.replace('$', '\\$')}\\s*\\(`).test(bare(t)))) { runs.add(n); grew = true; }
  }
  for (const m of file.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"]([^'"]+)['"]/g)) {
    const local = /^\.\//.test(m[2]);
    for (const p of m[1].split(',').map((x) => x.trim()).filter(Boolean)) {
      const [orig, alias = orig] = p.split(/\s+as\s+/).map((x) => x.trim());
      if (/(packages|plugins|scripts|plan)\//.test(m[2]) || (local && runs.has(orig))) names.add(alias);
    }
  }
  return [...names];
}
/** Which of `names` a body calls, plus a direct run of node. */
const calls = (body, names) => [...names.filter((n) => new RegExp(`(?<![\\w$.])${n.replace('$', '\\$')}\\s*\\(`).test(bare(body))),
  ...(/process\.execPath/.test(body) ? ['process.execPath'] : [])];

/** A test file gone at the head, or a verify/ folder that holds no test file there. */
const retiredPath = (p) => !existsSync(join(REPO, p)) || (!p.endsWith('.mjs') && !walk(join(REPO, p)).some((f) => /\.test\.mjs$/.test(f)));
const READS = /\b(readFileSync|read|show|readText|fileAt|textOf)\s*\(/;
const KINDS = {
  // reads a doc, plan or source file's text and matches it, running no head code
  source: ({ body, all, drives }) => drives.length === 0 && READS.test(all) && /assert\.|\.test\(/.test(body),
  // reads its own PR's file list, listing or item status from git or the tree, running no head code
  scope: ({ all, drives }) => drives.length === 0 && /['"](diff|ls-tree|cat-file|rev-parse)['"]|--name-only|--name-status|readdirSync|walk\(|status/.test(all),
  // asserts facts of data recorded under verify/ (a run, a transcript, a session's answer), running no head code on it
  recorded: ({ all, drives }) => drives.length === 0 && /evidence|fixture|transcript|journal|runs|record|answer|rubric|judge|scores/i.test(all),
  // compares what came back with a capture stored under verify/ or committed beside it
  capture: ({ body, all }) => /assert\.(deepEqual|equal|strictEqual)|===/.test(body) && /main-fixtures|evidence|committed|report|packet|brief\.md|recorded/i.test(all),
  // runs a test file this PR deletes, or an earlier commit's code fetched by sha or rebuilt from a stored diff
  retired: ({ body, all }) => {
    const paths = [...all.matchAll(/verify\/[a-z0-9-]+(?:\/[a-z0-9-]+\.test\.mjs)?/g)].map((m) => m[0]);
    return (paths.length > 0 && paths.some(retiredPath)) || /to-base\.diff|base: true|baseWritesUnder/.test(body);
  },
  // runs a test that npm test runs itself (test/docs.test.mjs, plugins/harness/test/capture.test.mjs), which the row names
  heldElsewhere: ({ all, row }) => ['test/docs.test.mjs', 'plugins/harness/test/capture.test.mjs', 'plugins/harness/test/finish-ms.test.mjs']
    .some((p) => all.includes(p.split('/').pop()) && existsSync(join(REPO, p)) && row.reason.includes(p)),
  // runs every file under test/regression/, which npm test runs itself, as the row says
  npmTest: ({ body, row }) => /test\/regression|files/.test(body) && /npm test/.test(row.reason),
  // tests the verifier's own helper in its folder, not harness code
  ownHelper: ({ file }) => !/from\s+['"][./]*(packages|plugins|scripts|plan)\//.test(file) && /from\s+['"]\.\/[a-z-]+\.mjs['"]/.test(file)
};

/** [file under verify/, title pattern or null for every test in the file, kind]. */
const LEFT = [
  ['comments-present-tense/readme.test.mjs', null, 'source'],
  ['comments-present-tense/strip.test.mjs', null, 'ownHelper'],
  ['done-with-the-build/scope.test.mjs', null, 'scope'],
  ['effort-scope-own-pr/full-clone-passes.test.mjs', /^(the head|a branch)/, 'retired'],
  ['effort-scope-own-pr/full-clone-passes.test.mjs', /pinned commits are reachable/, 'scope'],
  ['effort-scope-own-pr/own-pr-reads-git.test.mjs', /PR, then a stray/, 'retired'],
  ['effort-scope-own-pr/own-pr-reads-git.test.mjs', /pinned commits are reachable/, 'scope'],
  ['effort-scope-own-pr/scope.test.mjs', null, 'scope'],
  ['evidence-gate-edges/plan-passes.test.mjs', /PR changes only/, 'scope'],
  ['evidence-gate-edges/rules-written.test.mjs', null, 'source'],
  ['fix-budget-rule/backfill-true.test.mjs', null, 'source'],
  ['fix-trace-writes-clone-cwd/child-before-return.test.mjs', /^base:/, 'retired'],
  ['fix-trace-writes-clone-cwd/scope.test.mjs', null, 'scope'],
  ['fresh-reader-gaps/budget.test.mjs', /^BUDGET/, 'source'],
  ['fresh-reader-gaps/budget.test.mjs', /docs\.test\.mjs passes/, 'heldElsewhere'],
  ['fresh-reader-gaps/fresh-reader-path.test.mjs', null, 'recorded'],
  ['fresh-reader-gaps/one-suite-command.test.mjs', /^CLAUDE\.md gives/, 'source'],
  ['fresh-reader-gaps/one-suite-command.test.mjs', /^(the command|node --test on the bare)/, 'retired'],
  ['fresh-reader-gaps/release-paths-named-once.test.mjs', null, 'source'],
  ['fresh-reader-gaps/suite-and-scope.test.mjs', /the item is done|PR changes only/, 'scope'],
  ['item-head-trim/scope.test.mjs', null, 'scope'],
  ['item-writer-gaps/fresh-writer.test.mjs', null, 'recorded'],
  ['item-writer-gaps/ready-fields-named.test.mjs', /^(How an item is written|Changing the plan says)/, 'source'],
  ['item-writer-gaps/suite-and-scope.test.mjs', /PR changes only/, 'scope'],
  ['item-writer-gaps/suite-and-scope.test.mjs', /docs\.test\.mjs passes/, 'heldElsewhere'],
  ['item-writer-gaps/suite-and-scope.test.mjs', /^CLAUDE\.md names the four/, 'source'],
  ['map-once-traps-written/map-complete.test.mjs', /Layout table names every|holds no fenced folder tree/, 'source'],
  ['map-once-traps-written/map-complete.test.mjs', /docs\.test\.mjs passes at the head/, 'heldElsewhere'],
  ['map-once-traps-written/suite-and-scope.test.mjs', /sets no PR_BRANCH|outputs are what its head names/, 'source'],
  ['map-once-traps-written/suite-and-scope.test.mjs', /PR changes only/, 'scope'],
  ['pinned-fetch-temp-repo/no-checkout-fetch.test.mjs', null, 'retired'],
  ['pinned-fetch-temp-repo/parallel-green.test.mjs', null, 'retired'],
  ['pinned-fetch-temp-repo/scope.test.mjs', null, 'scope'],
  ['pinned-fetch-temp-repo/trap-written.test.mjs', null, 'source'],
  ['plan-reader-effort/plan-and-suite-pass.test.mjs', /PR changes only/, 'scope'],
  ['plan-reader-effort/rules-written.test.mjs', null, 'source'],
  ['probe-plugin-agents/evidence.test.mjs', null, 'recorded'],
  ['refine-brief-stage/cases.test.mjs', /3 baseline runs/, 'recorded'],
  ['refine-brief-stage/cases.test.mjs', /unchanged from main|only gained the new criteria|baseline system prompts are all still/, 'capture'],
  ['refine-brief-stage/real.test.mjs', /^all 3 runs pinned|^builder briefs carry no/, 'recorded'],
  ['refine-brief-stage/real.test.mjs', /^every command the briefs give/, 'recorded'],
  ['refine-brief-stage/rubric.test.mjs', /^rubric has|^judge check/, 'recorded'],
  ['refine-brief-stage/variants.test.mjs', /recomputes from the rescored|all 27 runs pinned|exactly one change|^kept:|^blind reads/, 'capture'],
  ['retire-doing/scope.test.mjs', null, 'scope'],
  ['retire-doing/texts-name-the-path.test.mjs', null, 'source'],
  ['retro-first-item/retro.test.mjs', null, 'recorded'],
  ['rule-text-tests/fresh-verifier-follows.test.mjs', null, 'recorded'],
  ['rule-text-tests/rule-written.test.mjs', null, 'source'],
  ['rule-text-tests/suite-and-scope.test.mjs', /the item is done|PR changes only/, 'scope'],
  ['rules-said-once/suite-and-scope.test.mjs', /PR changes only/, 'scope'],
  ['rules-said-once/texts-hold-paths.test.mjs', null, 'source'],
  ['scope-suite-own-pr/full-clone-passes.test.mjs', /passes in tree mode|fails/, 'retired'],
  ['scope-suite-own-pr/full-clone-passes.test.mjs', /pinned commits are reachable/, 'scope'],
  ['scope-suite-own-pr/own-pr-reads-git.test.mjs', /PR, then a stray/, 'retired'],
  ['scope-suite-own-pr/own-pr-reads-git.test.mjs', /pinned commits are reachable/, 'scope'],
  ['scope-suite-own-pr/scope.test.mjs', null, 'scope'],
  ['self-edit-check-snapshot/runs-without-strace.test.mjs', /names the tool as a command/, 'source'],
  ['test-fixture-edges/detached-release-clone.test.mjs', /build change taken out/, 'retired'],
  ['test-fixture-edges/keep-across-fs.test.mjs', /build change taken out/, 'retired'],
  ['test-fixture-edges/p95-over-bare.test.mjs', /cheap test passes at the head|cheap test fails on p95 at the head/, 'heldElsewhere'],
  ['test-fixture-edges/p95-over-bare.test.mjs', /build change taken out/, 'retired'],
  ['test-fixture-edges/scope.test.mjs', null, 'scope'],
  ['tournament-kit/generic.test.mjs', /names no tournament|hard-codes no stage id/, 'source'],
  ['tournament-kit/index.test.mjs', null, 'source'],
  ['tournament-scoring-floors/rescore.test.mjs', /own scores\.json agrees/, 'recorded'],
  ['trial-fail-path/trials.test.mjs', /^real-agents: the injected build/, 'recorded'],
  ['trial-fail-path/trials.test.mjs', /^stage-record:|^real-agents: each pending prompt|^refusals-counted:/, 'capture'],
  ['verdict-cutoff-at-verified-sha/plan-passes.test.mjs', /PR changes only/, 'scope'],
  ['verdict-cutoff-at-verified-sha/rules-written.test.mjs', null, 'source'],
  ['verification-contract/plan-and-suite-pass.test.mjs', /listed phrases exist/, 'source'],
  ['verifier-reader-gaps/done-on-when-module.test.mjs', /^step 2 ties/, 'source'],
  ['verifier-reader-gaps/fresh-verifier.test.mjs', null, 'recorded'],
  ['verifier-reader-gaps/local-gate-run.test.mjs', /gives one local verdict-gate command/, 'source'],
  ['verifier-reader-gaps/suite-and-scope.test.mjs', /PR changes only/, 'scope'],
  ['verifier-reader-gaps/suite-and-scope.test.mjs', /fresh-reader-gaps step-2/, 'retired'],
  ['verifier-reader-gaps/world-needs-no-test.test.mjs', /The verdict, says/, 'source'],
  ['verify-evidence-policy/gate-wired.test.mjs', /verdict\.yml gates job/, 'source'],
  ['verify-evidence-policy/gate-wired.test.mjs', /own verify\/ folder/, 'retired'],
  ['verify-evidence-policy/plan-passes.test.mjs', /PR changes only/, 'scope'],
  ['verify-evidence-policy/policy-written.test.mjs', null, 'source'],
  ['after-verdict-gaps/after-verdict-steps.test.mjs', null, 'source'],
  ['after-verdict-gaps/flake-trap.test.mjs', null, 'source'],
  ['after-verdict-gaps/fresh-merger.test.mjs', null, 'recorded'],
  ['after-verdict-gaps/released-named-once.test.mjs', /README\.md's Releases names RELEASED/, 'source'],
  ['after-verdict-gaps/suite-and-scope.test.mjs', /PR changes only/, 'scope'],
  ['after-verdict-gaps/suite-and-scope.test.mjs', /docs\.test\.mjs passes/, 'heldElsewhere'],
  ['after-verdict-gaps/terms-defined.test.mjs', null, 'source'],
  ['finish-ms-transcript-fixture/reads-fixture.test.mjs', /^finish-ms\.test\.mjs passes in a head copy/, 'heldElsewhere'],
  ['finish-ms-transcript-fixture/reads-fixture.test.mjs', /^no file under plugins/, 'source'],
  ['finish-ms-transcript-fixture/scope.test.mjs', null, 'scope'],
  ...['verify-regression-engine', 'verify-regression-plugin'].flatMap((s) => [
    [`${s}/folders.test.mjs`, null, 'scope'],
    [`${s}/table.test.mjs`, null, 'scope'],
    [`${s}/scope.test.mjs`, null, 'scope'],
    [`${s}/left-reasons.test.mjs`, null, 'source'],
    [`${s}/one-helper.test.mjs`, null, 'source'],
    [`${s}/moved-pass.test.mjs`, /passes alone/, 'npmTest'],
    [`${s}/moved-pass.test.mjs`, /first comment|header reader|names a path under verify/, 'source']
  ])
];

/** [title, body] of every test in a file, top level or in a loop. */
function testsOf(text) {
  const starts = [...text.matchAll(/^([ \t]*)test\((['"`])((?:\\.|(?!\2).)*)\2/gm)];
  return starts.map((m, i) => {
    const rest = text.slice(m.index, starts[i + 1]?.index ?? text.length);
    const close = rest.search(new RegExp(`\\n${m[1]}\\}\\)?\\);?[ \\t]*(\\n|$)`));
    return [m[3], close < 0 ? rest : rest.slice(0, close + m[1].length + 4)];
  });
}

const rowOf = (file) => regressionTable().find((r) => r.file === `verify/${file}`);

test('left-reasons-hold: every left file and split row the table names has a case here', () => {
  const cased = new Set(LEFT.map(([f]) => f));
  for (const r of regressionTable().filter((x) => x.verdict !== 'moved')) {
    const f = r.file.replace(/^verify\//, '');
    if (f === 'fix-trace-writes-clone-cwd/child-after-return.test.mjs') continue; // no left test at the base: see observations
    assert.ok(cased.has(f), `${r.file}: its left tests have a case`);
  }
  for (const [f] of LEFT) assert.ok(rowOf(f) && rowOf(f).verdict !== 'moved', `${f}: the table says left or split`);
});

test('left-reasons-hold: every test of a whole-file left row has a case', (t) => {
  if (!gitDir()) return t.skip(`base ${BASE} not readable here`);
  for (const r of regressionTable().filter((x) => x.verdict === 'left')) {
    const f = r.file.replace(/^verify\//, '');
    const cases = LEFT.filter(([x]) => x === f);
    for (const [title] of testsOf(show(BASE, r.file))) assert.ok(cases.some(([, re]) => !re || re.test(title)), `${f}: "${title}" has a case`);
  }
});

for (const [file, title, kind] of LEFT) {
  test(`left-reasons-hold: ${file}${title ? ` ${title}` : ''} is ${kind}`, (t) => {
    if (!gitDir()) return t.skip(`base ${BASE} not readable here`);
    const text = show(BASE, `verify/${file}`);
    const folder = file.split('/')[0];
    const names = drivers(text, folder);
    const picked = testsOf(text).filter(([name]) => !title || title.test(name));
    assert.ok(picked.length >= 1, `${file}: a test matches ${title}`);
    for (const [name, body] of picked) {
      const drives = calls(body, names);
      assert.ok(KINDS[kind]({ body, file: text, all: [text, ...Object.values(helpersOf(folder))].join('\n'), drives, row: rowOf(file) }), `${file}: "${name}" is ${kind} (drives: ${drives.join(', ') || 'nothing'})`);
      if (drives.length) t.diagnostic(`"${name}" runs ${drives.join(', ')}`);
    }
  });
}

test('left-reasons-hold: the kinds that run no head code refuse a moved test that drives the plan check (control)', (t) => {
  if (!gitDir()) return t.skip(`base ${BASE} not readable here`);
  const file = 'verify/retire-doing/doing-refused.test.mjs';
  const text = show(BASE, file);
  const names = drivers(text, 'retire-doing');
  for (const [name, body] of testsOf(text)) {
    const drives = calls(body, names);
    assert.ok(drives.length > 0, `doing-refused: "${name}" drives head code`);
    for (const k of ['source', 'scope', 'recorded']) assert.ok(!KINDS[k]({ body, file: text, all: text, drives, row: { reason: '' } }), `doing-refused: "${name}" is not ${k}`);
  }
});

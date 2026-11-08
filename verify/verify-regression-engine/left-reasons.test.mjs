// left-reasons-hold: each left test, and each left half of a split, read at the base, is of a kind the item lets
// leave: it matched source or doc text, compared a listing, compared with a capture stored under verify/, asserted a
// recorded past run without running head code on it, or checked a retired path. Each case below names the test (a
// whole file, or one test by its title) and what in its base text shows the kind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASE, REPO, haveCommits, regressionTable, show } from './lib.mjs';

// Calls that run head code on an input and look at what came back.
const DRIVES = /\b(restore|offer|applyEvent|accept|inputsOfWake|runHook|spawnSync|execFileSync|loadWorkflow|render|replay)\(/;
const READS_TEXT = /readFileSync|readdirSync|git', \['-C', REPO, 'show'|ls-files/;
const MATCHES = /assert\.(match|doesNotMatch)|\.test\(|\.match(All)?\(|\.includes\(/;
/** Code with string and regex literals blanked, so a call named inside an asserted line of source is not a call. */
const bare = (b) => b.replace(/'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*"|`(?:\\.|[^`\\])*`/g, "''").replace(/([(,=!&|:]\s*)\/(?:\\.|\[(?:\\.|[^\]])*\]|[^/\n\\])+\/[gimsuy]*/g, '$1/x/');

const KINDS = {
  source: (b) => (READS_TEXT.test(b) || /\bcode\(/.test(b)) && (MATCHES.test(b) || /JSON\.parse/.test(b)) && !DRIVES.test(bare(b)),
  capture: (b, f) => (/\bMAIN\b/.test(b) && /evidence\/main/.test(f)) || /evidence\/main|main-scenarios|main\.json|base-scenario|base-direct|literals|base-workflows|merge-workflows|BASE_FIXTURES|MERGE_FIXTURES|baseRaw|baseWorkflows|brief\.md|exports\.json|trace\.json/.test(b),
  recorded: (b) => /evidence|tournaments\/|TRIAL|saved|ev\(|EV\b|journal/.test(b) && !DRIVES.test(bare(b)),
  // Harness output a past run left under verify/, read as a folder list (not input by the item's rule).
  ownOutput: (b) => /verify\/engine-toy-run\/evidence/.test(b),
  listing: (b) => /assert\.ok\([^)]*(length|size)\s*>=\s*\d+|assert\.equal\([^)]*\.length,\s*\d+/.test(b),
  child: (b) => /journals-replay\.test\.mjs/.test(b) && /pass/.test(b)
};

/** [suite/file, title pattern or null for the whole file, kind, why]. */
const LEFT = [
  ['engine-actor-returns/world.test.mjs', null, 'recorded', 'the ar2 and ar4 journals'],
  ['engine-actors/actors.test.mjs', /^world /, 'recorded', 'the item-va2 run'],
  ['engine-cards-standin/world.test.mjs', null, 'recorded', 'the sa-cards1 run'],
  ['engine-effects/merge-at-sha.test.mjs', null, 'recorded', 'PRs 15 and 17'],
  ['engine-effects/outside-merge.test.mjs', /^the saved evidence/, 'recorded', 'the saved closed-PR list'],
  ['engine-effects/red-ci.test.mjs', /^the saved REST facts/, 'recorded', 'the saved check run'],
  ['engine-host/forge.test.mjs', /^FINDING/, 'finding', 'an observed defect, recorded open in a decision'],
  ['engine-host/plugin-tools.test.mjs', null, 'source', 'plugin.json, .mcp.json and scripts'],
  ['engine-stage-contract/stage-record.test.mjs', /adopt trial/, 'recorded', 'the adopt trial\'s folders'],
  ['engine-toy-run/toy-run.test.mjs', null, 'recorded', 'the toy run'],
  ['fix-blocked-retry/retry.test.mjs', /^not-blocked-unchanged/, 'capture', 'main-scenarios.json'],
  ['fix-reminder-wake/reminder.test.mjs', /decision capture/, 'source', 'a decision file\'s JSON'],
  ['fix-verify-issue-echo/echo.test.mjs', /^prompt-agrees/, 'source', 'prompt wording'],
  ['fix-waiting-wake/load-check.test.mjs', /every asking state has/, 'source', 'the workflow files\' content'],
  ['prompt-catalogue/deps.test.mjs', /CLAUDE\.md and docs\/layout\.md/, 'source', 'CLAUDE.md and docs/layout.md'],
  ['prompt-catalogue/same-text.test.mjs', null, 'capture', 'base-scenario.json, base-direct.json, literals.mjs'],
  ['retire-pinned-legacy/one-check.test.mjs', null, 'source', 'engine source'],
  ['run-lifecycle-store/answers.test.mjs', /^answers-unchanged: every step/, 'capture', 'evidence/main/trace.json'],
  ['run-lifecycle-store/budget.test.mjs', /no number 10/, 'source', 'run module source'],
  ['run-lifecycle-store/budget.test.mjs', /no run module reads the journal/, 'source', 'run module source'],
  ['run-lifecycle-store/states.test.mjs', /under verify\/engine-toy-run/, 'ownOutput', 'the toy run\'s run folders'],
  ['run-lifecycle-store/owner.test.mjs', null, 'source', 'engine and plugin source, exports.json'],
  ['run-names-one-module/node-only.test.mjs', /imports only node/, 'source', 'names.js imports'],
  ['run-names-one-module/one-place.test.mjs', null, 'source', 'engine and plugin source'],
  ['stage-bench/edit-safe.test.mjs', /every committed journal replays/, 'listing', 'the committed journal count'],
  ['stage-bench/same-prompt.test.mjs', /committed bench run folder/, 'capture', 'committed brief.md files'],
  ['stage-contract-declares-rules/no-guessing.test.mjs', null, 'source', 'engine source'],
  ['stage-contract-declares-rules/same.test.mjs', null, 'capture', 'evidence/main.json'],
  ['stage-prompt-files/base-fixture.test.mjs', null, 'capture', 'base-workflows/'],
  ['stage-prompt-files/files.test.mjs', null, 'capture', 'base JSON and merge-workflows/'],
  ['stage-prompt-files/pin.test.mjs', /every committed journal still replays/, 'child', 'test/journals-replay.test.mjs'],
  ['stage-prompt-files/same-prompt.test.mjs', null, 'capture', 'base JSON renders and committed brief.md']
];

/** The text of the test whose title matches `title`, up to the next top-level test(, or the whole file. */
function bodyOf(text, title) {
  if (!title) return text;
  const starts = [...text.matchAll(/^\s*test\((['"`])(.*?)\1/gm)];
  const i = starts.findIndex((m) => title.test(m[2]));
  assert.ok(i >= 0, `a test titled ${title}`);
  return text.slice(starts[i].index, starts[i + 1]?.index ?? text.length);
}

test('left-reasons-hold: every left file and left half the table names has a case here', () => {
  const rows = regressionTable().filter((r) => r.verdict !== 'moved');
  const cased = new Set(LEFT.map(([f]) => f));
  const missing = rows.map((r) => `${r.suite}/${r.file}`).filter((f) => !cased.has(f));
  assert.deepEqual(missing, []);
});

for (const [file, title, kind, why] of LEFT) {
  test(`left-reasons-hold: ${file}${title ? ` ${title}` : ''} is ${kind} (${why})`, (t) => {
    if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
    const body = bodyOf(show(BASE, `verify/${file}`), title);
    if (kind === 'finding') {
      // It drives the wake parser, but asserts a defect: titled "not asserted as good", and the plan keeps it open.
      assert.match(body, /FINDING \(observed, not asserted as good\)/);
      assert.match(readFileSync(join(REPO, 'plan/decisions/2026-10-30-engine-effects.md'), 'utf8'), /`<\/event>` still cuts that event/);
      return;
    }
    assert.ok(KINDS[kind](body, show(BASE, `verify/${file}`)), `${file}: ${kind}`);
  });
}

test('left-reasons-hold: the kinds refuse a test that drives the engine and asserts what came back (control)', (t) => {
  if (!haveCommits()) return t.skip(`base ${BASE} not readable here`);
  // A moved test at the base: two-hosts drives restore and offer and asserts on the result.
  const body = show(BASE, 'verify/fix-other-host-runs-effects/two-hosts.test.mjs');
  assert.ok(!KINDS.recorded(body) && !KINDS.capture(body, body) && !KINDS.child(body) && !KINDS.source(body) && !KINDS.ownOutput(body), 'two-hosts is no left kind');
  assert.ok(DRIVES.test(body));
});

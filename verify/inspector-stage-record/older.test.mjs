// Brief line "a run folder with no stage.json (an older journal) renders as before" (outcome: "runs without
// stage.json render as before"). The October journals in the project's shared folder are built twice, with the
// inspector of main at the PR's base (277d3f2) and with this head's, both replayed on main at 36da3e4 (the engine
// that recorded them), and every run's rendered summary, steps, map and step trail are compared as text in Chromium.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, symlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skipReason, playwright, buildPage, hasCommit, REPO, OLD_ENGINE } from './lib.mjs';

const BASE = '277d3f2f3067d71443da6debaee2ac4963fd063b';
const JOURNALS = ['first-real-issue', 'toy-run', 'toy-run-returns', 'toy-run-views'].map((n) => ({ n, journal: `/mnt/project-files/${n}/harness/journal` }));
const skip = skipReason() || (!hasCommit(BASE) || !hasCommit(OLD_ENGINE) ? `commit ${BASE} or ${OLD_ENGINE} not in this clone` : false) ||
  (!existsSync(join(JOURNALS[0].journal, 'items')) ? `no October journal at ${JOURNALS[0].journal}` : false);
let pages = null;

const worktree = (sha, dir) => {
  execFileSync('git', ['-C', REPO, 'worktree', 'add', '-q', '--detach', dir, sha], { stdio: 'ignore' });
  symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
  return dir;
};

const SHOW = () => ({
  pick: document.querySelector('#pick').value,
  summary: document.querySelector('#summary').textContent,
  glance: document.querySelector('#glance').textContent,
  flow: !!document.querySelector('#glance .flow'),
  stage: document.querySelectorAll('#steps .stage').length,
  trail: document.querySelector('#trail').textContent,
  graph: document.querySelector('#graph').textContent,
  steps: Array.from(document.querySelectorAll('#steps details.step')).map((d) => d.textContent)
});

before(async () => {
  if (skip) return;
  const tmp = mkdtempSync(join(tmpdir(), 'isr-older-'));
  const oldEngine = worktree(OLD_ENGINE, join(tmp, 'engine'));
  const base = worktree(BASE, join(tmp, 'base'));
  const src = (engine) => JOURNALS.filter((j) => existsSync(join(j.journal, 'items'))).map((j) => ({ origin: 'v', kind: 'real', engine, journal: j.journal, label: j.n }));
  const before_ = buildPage(src(oldEngine), { buildScript: join(base, 'scripts/inspector/build.mjs') });
  const after_ = buildPage(src({ commit: OLD_ENGINE }));
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(after_.url);
  const ids = await page.$$eval('#pick option', (os) => os.map((o) => o.value).filter((v) => v && !v.startsWith('wf:')));
  pages = { ids, runs: [], errors };
  for (const id of ids) {
    const one = {};
    for (const [k, b] of [['before', before_], ['after', after_]]) {
      await page.goto('about:blank');
      await page.goto(b.url + '#run=' + encodeURIComponent(id));
      // The one expected difference: where each build checked the engine out. Named the same in both.
      const shown = await page.evaluate(SHOW);
      const eng = k === 'before' ? oldEngine : join(after_.dir, 'capture', `engine-${OLD_ENGINE.slice(0, 12)}`);
      one[k] = JSON.parse(JSON.stringify(shown).split(eng).join('<engine checkout>'));
    }
    pages.runs.push({ id, ...one });
  }
  await browser.close();
  execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', oldEngine], { stdio: 'ignore' });
  execFileSync('git', ['-C', REPO, 'worktree', 'remove', '--force', base], { stdio: 'ignore' });
});

test('older journals: no Stage view and no flow strip, and the page has no errors', { skip }, () => {
  assert.equal(pages.errors.length, 0, pages.errors.join('\n'));
  assert.ok(pages.ids.length >= 4, `only ${pages.ids.length} runs`);
  for (const r of pages.runs) { assert.equal(r.after.pick, r.id); assert.equal(r.after.flow, false, r.id); assert.equal(r.after.stage, 0, r.id); }
});

test('older journals: each run renders as it did on main before this PR (summary, glance, map, trail, every step)', { skip }, () => {
  for (const r of pages.runs) {
    assert.equal(r.before.pick, r.id, `${r.id} missing from the base build`);
    for (const k of ['summary', 'glance', 'graph', 'trail']) assert.equal(r.after[k], r.before[k], `${r.id}: ${k} differs`);
    assert.equal(r.after.steps.length, r.before.steps.length, `${r.id}: step count`);
    r.after.steps.forEach((s, i) => assert.equal(s, r.before.steps[i], `${r.id}: step ${i} differs`));
  }
});

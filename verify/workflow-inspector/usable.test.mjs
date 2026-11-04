// Expect usable (plan/items/workflow-inspector.md): in headless Chromium at 1280px and 390px, light and dark, the
// page has no console errors and no horizontal page scroll, works by keyboard, and compare mode shows the same actor
// of two runs side by side. Screenshots go to $WI_SHOTS (else a temp folder) for the verifier to read.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skipReason, buildPage, playwright } from './lib.mjs';

const skip = skipReason();

test('usable: 1280 and 390 px, light and dark, keyboard, compare', { skip, timeout: 600000 }, async () => {
  const { url } = buildPage();
  const shots = process.env.WI_SHOTS ?? mkdtempSync(join(tmpdir(), 'wi-shots-'));
  mkdirSync(shots, { recursive: true });
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const problems = [];
  try {
    for (const width of [1280, 390]) for (const scheme of ['light', 'dark']) {
      const tag = `${width}-${scheme}`;
      const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme });
      const page = await ctx.newPage();
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`${tag} console: ${m.text()}`); });
      page.on('pageerror', (e) => problems.push(`${tag} page error: ${e.message}`));
      const sideways = async (where) => {
        const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, bw: document.body.scrollWidth }));
        if (r.sw > r.cw + 1 || r.bw > r.cw + 1) problems.push(`${tag} ${where}: page scrolls sideways (${r.sw}/${r.bw} > ${r.cw})`);
      };
      await page.goto(url);
      // The theme the page shows follows the scheme: body background is dark in dark, light in light.
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      const lum = bg.match(/\d+/g).slice(0, 3).reduce((a, b) => a + Number(b), 0) / 3;
      if (scheme === 'dark' ? lum > 80 : lum < 170) problems.push(`${tag}: body background ${bg} does not match ${scheme}`);
      await sideways('first load');
      await page.screenshot({ path: join(shots, `${tag}-top.png`) });

      // Every run, every step and layer opened.
      const runs = await page.evaluate(() => window.INSPECTOR_DATA.runs.map((r) => r.id));
      for (const id of runs) {
        await page.goto(url + '#run=' + encodeURIComponent(id)); await page.reload();
        await page.evaluate(() => document.querySelectorAll('details').forEach((d) => { d.open = true; }));
        await sideways(`run ${id} all open`);
      }
      const fri = runs.find((r) => /fri-jsonl-lint-2$/.test(r));
      await page.goto(url + '#run=' + encodeURIComponent(fri) + '&step=0'); await page.reload();
      await page.evaluate(() => { const s = document.getElementById('step-0'); s.open = true; s.scrollIntoView(); });
      await page.screenshot({ path: join(shots, `${tag}-fri-step0.png`) });
      await page.evaluate(() => { const l = Array.from(document.querySelectorAll('#step-0 details.layer')).find((d) => /Prompt/.test(d.querySelector('summary').textContent)); l.scrollIntoView(); });
      await page.screenshot({ path: join(shots, `${tag}-fri-prompt.png`) });

      // Keyboard only, from the top: reach the run picker, change the run, open a step, reach the compare tab.
      await page.goto(url); await page.reload();
      let at = '';
      for (let i = 0; i < 40 && at !== 'pick'; i++) { await page.keyboard.press('Tab'); at = await page.evaluate(() => document.activeElement?.id); }
      if (at !== 'pick') problems.push(`${tag}: Tab never reached the run picker`);
      const before = await page.$eval('#pick', (s) => s.value);
      await page.keyboard.press('ArrowDown');
      await page.waitForTimeout(200);
      const after = await page.$eval('#pick', (s) => s.value);
      if (before === after) problems.push(`${tag}: ArrowDown on the picker did not change the run`);
      let opened = false;
      for (let i = 0; i < 200 && !opened; i++) {
        await page.keyboard.press('Tab');
        const onStep = await page.evaluate(() => document.activeElement?.tagName === 'SUMMARY' && document.activeElement.parentElement.classList.contains('step'));
        if (onStep) { await page.keyboard.press('Enter'); opened = await page.evaluate(() => document.activeElement.parentElement.open); }
      }
      if (!opened) problems.push(`${tag}: no step summary opened with Tab and Enter`);
      const focusRing = await page.evaluate(() => { const s = getComputedStyle(document.activeElement); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; });
      if (!focusRing) problems.push(`${tag}: focused step summary shows no focus outline`);
      await page.screenshot({ path: join(shots, `${tag}-keyboard.png`) });
      await page.focus('#tab-one');
      await page.keyboard.press('ArrowRight');
      const cmpShown = await page.evaluate(() => !document.getElementById('view-cmp').hidden && document.activeElement.id === 'tab-cmp');
      if (!cmpShown) problems.push(`${tag}: ArrowRight on the tabs did not open compare`);

      // Compare: lane A Q1 left, lane C Q1 right; the same actor lined up in two columns.
      const ids = await page.evaluate(() => window.INSPECTOR_DATA.runs.map((r) => ({ id: r.id, o: r.origin, l: r.label })));
      const a = ids.find((r) => /^Lane A/.test(r.o) && /Q1/.test(r.l)).id; const c = ids.find((r) => /^Lane C/.test(r.o) && /Q1/.test(r.l)).id;
      await page.selectOption('#cmpa', a); await page.selectOption('#cmpb', c);
      await page.waitForTimeout(200);
      const pairs = await page.$$eval('#pairs article.pair', (as) => as.map((p) => ({ key: p.querySelector('h3').textContent, cols: Array.from(p.querySelector('.cols').children).map((col) => ({ h: col.querySelector('h4').textContent, who: col.textContent, left: col.getBoundingClientRect().left, top: col.getBoundingClientRect().top })) })));
      for (const k of ['brief #1', 'build #1', 'verify #1']) {
        const p = pairs.find((x) => x.key === k);
        if (!p) { problems.push(`${tag}: compare has no ${k} pair`); continue; }
        if (p.cols.length !== 2) problems.push(`${tag}: ${k} has ${p.cols.length} columns`);
        if (!/Lane A/.test(p.cols[0].h) || !/Lane C/.test(p.cols[1].h)) problems.push(`${tag}: ${k} columns are ${p.cols.map((x) => x.h)}`);
        if (p.cols.some((x) => /This run has no/.test(x.who))) problems.push(`${tag}: ${k} missing on one side`);
        if (width >= 1280 && !(p.cols[1].left > p.cols[0].left && Math.abs(p.cols[1].top - p.cols[0].top) < 4)) problems.push(`${tag}: ${k} columns not side by side`);
      }
      await sideways('compare');
      await page.screenshot({ path: join(shots, `${tag}-compare.png`) });
      await page.evaluate(() => document.querySelector('#pairs article.pair').scrollIntoView());
      await page.screenshot({ path: join(shots, `${tag}-compare-pair.png`) });
      await ctx.close();
    }
  } finally { await browser.close(); }
  console.log(`screenshots in ${shots}`);
  assert.deepEqual(problems, []);
});

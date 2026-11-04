#!/usr/bin/env node
// Workflow Inspector page check (docs/inspector.md): opens a built index.html in headless Chromium and checks every
// run, every step, every workflow-only map and compare mode for console errors and horizontal page scroll at 390px
// and 1280px. Needs Playwright, which is not a dependency of this repo: pass its path with --playwright, or set
// PLAYWRIGHT (a path to playwright's index.mjs). Exits 1 on any problem.
//   node scripts/inspector/check-page.mjs [--out /home/user/inspector-out] [--playwright <index.mjs>] [--chrome <binary>]
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const opt = {};
const argv = process.argv.slice(2);
for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];
const out = resolve(opt.out ?? '/home/user/inspector-out');
const pw = opt.playwright ?? process.env.PLAYWRIGHT ?? '/opt/node22/lib/node_modules/playwright/index.mjs';
if (!existsSync(pw)) { console.error(`no Playwright at ${pw}; pass --playwright <path to playwright/index.mjs>`); process.exit(2); }
const { chromium } = await import(pathToFileURL(pw).href);
const chrome = opt.chrome ?? (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);
const browser = await chromium.launch(chrome ? { executablePath: chrome } : {});
const url = pathToFileURL(join(out, 'index.html')).href;
const problems = [];
for (const width of [390, 1280]) {
  const page = await browser.newPage({ viewport: { width, height: 900 } });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width}px console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`${width}px page error: ${e.message}`));
  await page.goto(url);
  const { runs, shelf } = await page.evaluate(() => ({ runs: window.INSPECTOR_DATA.runs.map((r) => ({ id: r.id, n: r.steps.length, kind: r.kind })), shelf: window.INSPECTOR_DATA.shelf.map((w) => w.id) }));
  // A table that is wider than its own box at desktop width hides its right-hand columns behind a sideways scroll.
  const fits = async (sel, what) => {
    if (width < 1280) return;
    const w = await page.evaluate((sel) => { const el = document.querySelector(sel); return el ? [el.scrollWidth, el.clientWidth] : null; }, sel);
    if (w && w[0] > w[1]) problems.push(`${width}px: ${what} is wider than its box (${w[0]} > ${w[1]})`);
  };
  const wide = async (what) => {
    const w = await page.evaluate(() => document.documentElement.scrollWidth);
    if (w > width) problems.push(`${width}px: ${what} scrolls sideways (scrollWidth ${w})`);
  };
  for (const r of runs) {
    for (let i = 0; i < r.n; i++) {
      await page.evaluate(([id, i]) => { location.hash = `run=${id}&step=${i}`; dispatchEvent(new PopStateEvent('popstate')); }, [r.id, i]);
      // Open every section of the step, as a reader clicking through would.
      await page.evaluate((i) => { const s = document.getElementById(`step-${i}`); s.querySelectorAll('details').forEach((d) => { d.open = true; }); }, i);
      await wide(`run ${r.id} step ${i}`);
      if (i === 0) await fits('#glance .tblwrap', `run ${r.id}: the steps-at-a-glance table`);
      if (r.kind === 'scripted') {
        const said = await page.evaluate((i) => document.getElementById(`step-${i}`).textContent, i);
        if (/Claude Code started it with/.test(said)) problems.push(`run ${r.id} step ${i}: a scripted step says Claude Code started an agent`);
      }
    }
  }
  for (const id of shelf) {
    await page.evaluate((id) => { location.hash = `wf=${id}`; dispatchEvent(new PopStateEvent('popstate')); }, id);
    await wide(`workflow ${id}`);
    await page.evaluate(() => document.querySelectorAll('#statestable details').forEach((d) => { d.open = true; }));
    await fits('#statestable .tblwrap', `workflow ${id}: the states table`);
  }
  for (const [a, b] of [[runs[0].id, runs.at(-1).id], ...runs.slice(1).map((r, k) => [runs[k].id, r.id])]) {
    await page.evaluate((h) => { location.hash = h; dispatchEvent(new PopStateEvent('popstate')); }, `compare=${a},${b}`);
    await page.evaluate(() => document.querySelectorAll('#pairs details').forEach((d) => { d.open = true; }));
    await wide(`compare ${a} vs ${b}`);
  }
  await page.close();
}
await browser.close();
if (problems.length) { console.log(problems.join('\n')); process.exit(1); }
console.log('page check: no console errors and no sideways page scroll at 390px and 1280px, over every run, step, workflow and compare pair');

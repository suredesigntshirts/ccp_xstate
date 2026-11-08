// Expect line page of plan item inspector-reads-records. The page is built from sources.json at the checkout; every
// source renders (nothing skipped). In Chromium at 1280 and 390 px, every step of every run is opened: no console or
// page error, each step names the state of every way out the engine tried, and each model run's step shows its
// prompt. check-page.mjs passes on the same build. The DOM checks skip when Playwright is not installed (as in CI).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { REPO, imp, tempDir } from './lib.mjs';

const PW = ['/opt/node-tools/node_modules/playwright/index.mjs', '/opt/node22/lib/node_modules/playwright/index.mjs'].find(existsSync) ?? null;
const CHROME = existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;

const { build } = await imp(REPO, 'scripts/inspector/build.mjs');
const out = tempDir('page');
const conf = JSON.parse(readFileSync(join(REPO, 'scripts/inspector/sources.json'), 'utf8'));
const built = await build({ config: join(REPO, 'scripts/inspector/sources.json'), out, captureDir: tempDir('cap') });

test('page: every source of sources.json is built, none skipped', () => {
  console.log('built', JSON.stringify({ runs: built.runs, skipped: built.skipped, sources: conf.sources.length }));
  assert.deepEqual(built.skipped, []);
  const data = JSON.parse(readFileSync(join(out, 'data.js'), 'utf8').replace(/^window\.INSPECTOR_DATA = /, '').replace(/;\n$/, ''));
  for (const s of conf.sources) assert.ok(data.runs.some((r) => r.label.startsWith(s.label)), `source ${s.label} has a run`);
  for (const r of data.runs) for (const s of r.steps) for (const a of s.actors) if (a.model) assert.equal(typeof a.layers.l2.text, 'string', `${r.id} ${a.effect}: prompt text`);
});

test('page: every run, step, way out and model prompt renders at 1280 and 390 px with no error', { skip: PW ? false : 'Playwright is not installed' }, async () => {
  const { chromium } = await import(pathToFileURL(PW).href);
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const problems = [];
  const seen = { steps: 0, waysOut: 0, prompts: 0 };
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      page.on('console', (m) => { if (m.type() === 'error') problems.push(`${width}px console: ${m.text()}`); });
      page.on('pageerror', (e) => problems.push(`${width}px page error: ${e.message}`));
      await page.goto(pathToFileURL(join(out, 'index.html')).href);
      const runs = await page.evaluate(() => window.INSPECTOR_DATA.runs.map((r) => ({
        id: r.id,
        steps: r.steps.map((s) => ({ ways: s.candidates.map((c) => c.stays ? c.from : c.to), prompts: s.actors.filter((a) => a.model).map((a) => a.layers.l2.text) }))
      })));
      for (const r of runs) {
        for (const [i, s] of r.steps.entries()) {
          await page.evaluate(([id, i]) => { location.hash = `run=${id}&step=${i}`; dispatchEvent(new PopStateEvent('popstate')); }, [r.id, i]);
          const text = await page.evaluate((i) => {
            const el = document.getElementById(`step-${i}`);
            if (!el) return null;
            el.querySelectorAll('details').forEach((d) => { d.open = true; });
            return el.innerText;
          }, i);
          if (text == null) { problems.push(`${width}px ${r.id} step ${i}: not rendered`); continue; }
          seen.steps++;
          for (const w of s.ways) {
            const name = w.split('.').pop();
            if (!text.includes(name)) problems.push(`${width}px ${r.id} step ${i}: way out to ${w} not shown`);
            seen.waysOut++;
          }
          for (const p of s.prompts) {
            const line = p.split('\n').map((l) => l.trim()).find((l) => l.length > 20 && !/^[#`{\["]/.test(l)) ?? p.trim().slice(0, 40);
            const probe = line.slice(0, 40);
            if (!text.replace(/\s+/g, ' ').includes(probe.replace(/\s+/g, ' '))) problems.push(`${width}px ${r.id} step ${i}: prompt not shown (${probe})`);
            seen.prompts++;
          }
        }
      }
      await page.close();
    }
  } finally {
    await browser.close();
  }
  console.log('page', JSON.stringify(seen), problems.slice(0, 20));
  assert.deepEqual(problems, []);
  assert.ok(seen.waysOut > 0 && seen.prompts > 0);
});

test('page: check-page.mjs passes on the build', { skip: PW ? false : 'Playwright is not installed' }, () => {
  const said = execFileSync(process.execPath, [join(REPO, 'scripts/inspector/check-page.mjs'), '--out', out, '--playwright', PW, ...(CHROME ? ['--chrome', CHROME] : [])], { encoding: 'utf8', timeout: 900000 });
  console.log(said.trim());
  assert.match(said, /page check: no console errors/);
});

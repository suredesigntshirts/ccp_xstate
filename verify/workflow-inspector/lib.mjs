// Verifier helpers for workflow-inspector (plan/items/workflow-inspector.md, "Verifier brief"). Not a test file.
// The checks need the local real journal, the tournament lane checkouts and Playwright; CI has none of them, so the
// tests skip with the reason from skipReason().
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const FRI = '/mnt/project-files/first-real-issue/harness/journal';
export const LANE_A = '/home/user/lanes/A-minimalist';
export const LANE_C = '/home/user/lanes/C-provenance';

export function playwright() {
  const req = createRequire(join(REPO, 'package.json'));
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return req(p); } catch { /* next */ }
  }
  return null;
}

export function skipReason() {
  if (!existsSync(join(FRI, 'items/fri-jsonl-lint-2.jsonl'))) return `no local journal at ${FRI}`;
  for (const l of [LANE_A, LANE_C]) if (!existsSync(join(l, 'packages/engine/test/tourney/Q1.test.js'))) return `no lane checkout at ${l}`;
  if (!playwright()) return 'Playwright is not installed';
  return false;
}

/** Builds the page with the documented command (docs/inspector.md) into a fresh folder. */
export function buildPage() {
  const dir = mkdtempSync(join(tmpdir(), 'wi-verify-'));
  const cfg = {
    engines: { [REPO]: 'Main', [LANE_A]: 'Lane A', [LANE_C]: 'Lane C' },
    sources: [
      { origin: 'Real runs (main engine)', kind: 'real', engine: REPO, journal: FRI, label: 'First real issue' },
      { origin: 'Lane A: minimalist (scripted)', engine: LANE_A, scenario: 'packages/engine/test/tourney/Q1.test.js', label: 'Q1 happy path' },
      { origin: 'Lane C: provenance (scripted)', engine: LANE_C, scenario: 'packages/engine/test/tourney/Q1.test.js', label: 'Q1 happy path' }
    ]
  };
  writeFileSync(join(dir, 'sources.json'), JSON.stringify(cfg));
  const out = join(dir, 'out');
  const log = execFileSync(process.execPath, [join(REPO, 'scripts/inspector/build.mjs'), '--config', join(dir, 'sources.json'), '--out', out, '--capture', join(dir, 'capture')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  return { out, url: pathToFileURL(join(out, 'index.html')).href, log, dir };
}

/** In the page: turns a rendered `pre.json` back into the value it shows (folded strings and keys included). */
export const DOM_TO_JSON = (pre) => {
  const c = pre.cloneNode(true);
  c.querySelectorAll('.hd, button, .tag').forEach((e) => e.remove());
  c.querySelectorAll('.j-s').forEach((s) => {
    const full = s.querySelector('.full');
    const t = full ? full.textContent : s.textContent.replace(/^"/, '').replace(/"$/, '');
    s.textContent = JSON.stringify(t);
  });
  return c.textContent;
};

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));
export const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : null);

/** Every JSON object or array embedded in a text, in order. */
export function embeddedJson(t) {
  const out = [];
  for (let i = 0; i < t.length; i++) {
    if (t[i] !== '{' && t[i] !== '[') continue;
    let depth = 0, inStr = false, end = -1;
    for (let j = i; j < t.length; j++) { const ch = t[j];
      if (inStr) { if (ch === '\\') j++; else if (ch === '"') inStr = false; continue; }
      if (ch === '"') inStr = true; else if (ch === '{' || ch === '[') depth++; else if (ch === '}' || ch === ']') { if (--depth === 0) { end = j + 1; break; } } }
    if (end < 0) continue;
    try { out.push(JSON.parse(t.slice(i, end))); i = end - 1; } catch { /* not JSON */ }
  }
  return out;
}

/** The engine's own writtenBrief(), lifted from its actors.js source and evaluated, to re-run the template. */
export function writtenBriefOf(engine) {
  const src = readFileSync(join(engine, 'packages/engine/src/actors.js'), 'utf8');
  const start = src.indexOf('const writtenBrief =');
  if (start < 0) return null;
  const rest = src.slice(start);
  const end = rest.search(/;\n\n/);
  // eslint-disable-next-line no-new-func
  return { fn: new Function(rest.slice(0, end + 1) + '\nreturn writtenBrief;')(), src: rest.slice(0, end + 1) };
}

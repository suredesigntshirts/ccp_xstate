// Verifier helpers for inspector-stage-record (plan/items/inspector-stage-record.md, "Verifier brief"). Not a test
// file. Written by the verifier session, separately from the builder: the page is read from the rendered DOM in
// Chromium and compared with stage.json on disk, never with the build's data.js. Playwright is not a dependency of
// this repo, so CI skips the DOM checks with the reason from skipReason().
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const TRIAL = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');
export const FRI = '/mnt/project-files/first-real-issue/harness/journal';
export const OLD_ENGINE = '36da3e4421c88e6d1762f1f671494a71f0b70940';

export function playwright() {
  const req = createRequire(join(REPO, 'package.json'));
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return req(p); } catch { /* next */ }
  }
  return null;
}

export const hasCommit = (sha) => { try { execFileSync('git', ['-C', REPO, 'cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; } };

export function skipReason() {
  if (!playwright()) return 'Playwright is not installed';
  return false;
}

export const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Every folder under dir (two levels) that holds items/*.jsonl. */
export function journalRoots(dir) {
  const out = [];
  const look = (d, depth) => {
    if (!existsSync(join(d, 'items')) || !readdirSync(join(d, 'items')).some((n) => n.endsWith('.jsonl'))) {
      if (depth < 2) for (const n of readdirSync(d, { withFileTypes: true })) if (n.isDirectory()) look(join(d, n.name), depth + 1);
      return;
    }
    out.push(d);
  };
  look(dir, 0);
  return out.sort();
}

/** Runs a tourney scenario on this head with TMPDIR set to a fresh folder; returns the journal roots it made. */
export function scenarioRoots(test, dir) {
  mkdirSync(dir, { recursive: true });
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  execFileSync(process.execPath, ['--test', join(REPO, 'packages/engine/test/tourney', test)], {
    cwd: REPO, env: { ...env, TMPDIR: dir, TMP: dir, TEMP: dir }, stdio: 'ignore', timeout: 300000
  });
  return journalRoots(dir);
}

/** Builds the page with the documented command (docs/inspector.md) from the given sources, into a fresh folder. */
export function buildPage(sources, { buildScript = join(REPO, 'scripts/inspector/build.mjs'), dir = mkdtempSync(join(tmpdir(), 'isr-verify-')) } = {}) {
  writeFileSync(join(dir, 'sources.json'), JSON.stringify({ sources }));
  const out = join(dir, 'out');
  const log = execFileSync(process.execPath, [buildScript, '--config', join(dir, 'sources.json'), '--out', out, '--capture', join(dir, 'capture')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: dirname(buildScript) });
  return { out, url: pathToFileURL(join(out, 'index.html')).href, log, dir };
}

/** The run ids the page uses, read from the built picker (DOM), so no data.js is read by the checks. */
export async function pickerRuns(page) {
  return page.$$eval('#pick option', (os) => os.map((o) => ({ id: o.value, text: o.textContent })).filter((o) => o.id && !o.id.startsWith('wf:')));
}

/** The journal's run starts: engine.effect run/start rows, with the step seq and state each started in. */
export function runStarts(journal, item) {
  const rows = readFileSync(join(journal, 'items', `${item}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return rows.filter((r) => r.kind === 'engine.effect' && r.payload?.type === 'run' && r.payload?.phase === 'start').map((r) => {
    let state = null; try { state = JSON.parse(r.state); } catch { /* keep null */ }
    return { run: r.payload.effect, actor: r.payload.actor, seq: Number(String(r.payload.transition).split('#').pop()), state };
  });
}

/** Every stage.json of an item, by run id. */
export function stageRecords(journal, item) {
  const dir = join(journal, 'items', item, 'runs');
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) if (existsSync(join(dir, f, 'stage.json'))) { const s = readJson(join(dir, f, 'stage.json')); out[s.run] = s; }
  return out;
}

export const seqOf = (t) => (t == null ? null : Number(String(t).split('#').pop()));
export const aid = (runId) => 'run-' + String(runId).replace(/[^A-Za-z0-9_-]/g, '_');

/** In the page: turns a rendered pre.json back into the JSON text it shows. */
export const DOM_TO_JSON = `(pre) => {
  const c = pre.cloneNode(true);
  c.querySelectorAll('.hd, button, .tag').forEach((e) => e.remove());
  c.querySelectorAll('.j-s').forEach((s) => {
    const full = s.querySelector('.full');
    const t = full ? full.textContent : s.textContent.replace(/^"/, '').replace(/"$/, '');
    s.textContent = JSON.stringify(t);
  });
  return c.textContent;
}`;

/** In the page: every Stage view of the open run, as the DOM shows it. */
export const EXTRACT_STAGES = `(domToJsonSrc) => {
  const domToJson = new Function('return ' + domToJsonSrc)();
  const links = (el) => Array.from(el.querySelectorAll('[data-goto]')).map((b) => ({ run: b.dataset.goto, index: Number(b.dataset.index), field: b.dataset.field || null, text: b.textContent }));
  const jumps = (el) => Array.from(el.querySelectorAll('[data-jump]')).map((b) => Number(b.dataset.jump));
  const dd = (box, label) => { const dt = Array.from(box.querySelectorAll(':scope > dl > dt')).find((d) => d.textContent === label); return dt ? dt.nextElementSibling : null; };
  return Array.from(document.querySelectorAll('#steps .actor')).filter((a) => a.querySelector('.stage')).map((a) => {
    const step = a.closest('details.step');
    const blocks = Array.from(a.querySelector('.stage').children).filter((c) => c.classList.contains('sblk'));
    const [b1, b2, b3] = blocks;
    const parts = Array.from(b1.querySelectorAll('.part')).map((p) => ({ part: p.querySelector('h6').textContent,
      pieces: Array.from(p.querySelectorAll('.piece')).map((x) => ({ text: x.querySelector('pre.txt').textContent, cls: x.className, src: x.querySelector('.srcline').textContent, codes: Array.from(x.querySelectorAll('.srcline code')).map((c) => c.textContent), links: links(x.querySelector('.srcline')) })) }));
    const inputs = Array.from(b2.querySelectorAll('.inp')).map((i) => {
      const val = dd(i, 'Value'); const pre = val.querySelector('pre.json');
      const from = dd(i, 'Read from'); const prod = dd(i, 'Produced by'); const ch = dd(i, 'Then changed');
      return { id: i.id, name: i.querySelector('header b').textContent, meaning: i.querySelector('.meaning')?.textContent ?? null,
        valueText: val.textContent, valueFull: pre ? domToJson(pre) : null,
        from: from.textContent, fromCode: from.querySelector(':scope > code')?.textContent ?? null,
        producer: { text: prod.textContent, codes: Array.from(prod.querySelectorAll('code')).map((c) => c.textContent), links: links(prod), jumps: jumps(prod) },
        amended: ch ? Array.from(ch.querySelectorAll(':scope > ul > li')).map((li) => ({ path: li.querySelector('code').textContent, text: li.textContent, codes: Array.from(li.querySelectorAll('code')).slice(1).map((c) => c.textContent), links: links(li), jumps: jumps(li) })) : [] };
    });
    const outPre = b3.querySelector('pre[aria-label="output"]'), errPre = b3.querySelector('pre[aria-label="error"]');
    const wrote = Array.from(b3.querySelectorAll('.inp')).map((w) => {
      const ps = Array.from(w.querySelectorAll(':scope > p.small'));
      return { head: w.querySelector('header b').textContent, headText: w.querySelector('header').textContent, headCodes: Array.from(w.querySelectorAll('header code')).map((c) => c.textContent),
        replaced: { text: ps[0].textContent, codes: Array.from(ps[0].querySelectorAll('code')).map((c) => c.textContent), links: links(ps[0]) },
        readers: Array.from(w.querySelectorAll(':scope > ul.readers > li')).map((li) => ({ text: li.textContent, codes: Array.from(li.querySelectorAll(':scope > code')).map((c) => c.textContent), bolds: Array.from(li.querySelectorAll(':scope > b')).map((c) => c.textContent), links: links(li) })),
        noReaders: !w.querySelector('ul.readers') };
    });
    return { box: a.id, stepIndex: step ? Number(step.dataset.index) : null, parts, inputs,
      outText: b3.textContent, output: outPre ? domToJson(outPre) : null, error: errPre ? domToJson(errPre) : null,
      stamped: Array.from(b3.querySelectorAll(':scope > p.small')).filter((p) => /stamped by the harness/.test(p.textContent)).flatMap((p) => Array.from(p.querySelectorAll('code')).map((c) => c.textContent)),
      hostMarked: outPre ? Array.from(outPre.querySelectorAll('.hostw')).length : 0,
      took: { jumps: jumps(b3.querySelector(':scope > p.small') || b3), text: (b3.querySelector(':scope > p.small') || b3).textContent },
      wrote };
  });
}`;

/** In the page: click every [data-goto] button (Stage views and flow strip), and say where each one landed. */
export const FOLLOW_LINKS = `async () => {
  const out = [];
  const all = Array.from(document.querySelectorAll('#steps .stage [data-goto], #glance .flow [data-goto]'));
  for (let k = 0; k < all.length; k++) {
    const b = Array.from(document.querySelectorAll('#steps .stage [data-goto], #glance .flow [data-goto]'))[k];
    const from = b.closest('.actor')?.id ?? 'flow';
    b.click();
    const act = document.activeElement;
    const box = act && act.closest ? act.closest('.actor') : null;
    const step = box ? box.closest('details.step') : null;
    out.push({ from, run: b.dataset.goto, index: Number(b.dataset.index), field: b.dataset.field || null, text: b.textContent,
      landedBox: box ? box.id : null, landedInput: act && act.classList && act.classList.contains('inp') ? act.id : null,
      landedStep: step ? Number(step.dataset.index) : null, stepOpen: step ? step.open : false,
      boxShowsRun: box ? (box.querySelector('.stage') ? true : null) : false,
      visible: act ? (() => { const r = act.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; })() : false });
  }
  return out;
}`;

/** In the page: the flow strip as shown: boxes and arrows in DOM order. */
export const EXTRACT_FLOW = `() => {
  const f = document.querySelector('#glance .flow'); if (!f) return null;
  return Array.from(f.children).map((c) => c.classList.contains('farrow') ? { arrow: c.textContent, none: c.classList.contains('none') }
    : { node: (c.querySelector('[data-goto]') || c.querySelector('b')).textContent, run: c.querySelector('[data-goto]')?.dataset.goto ?? 'start', lines: Array.from(c.querySelectorAll('.fin')).map((x) => x.textContent) });
}`;

// Expect: inspector-stage-record/true-to-record, inspector-stage-record/flow
// In Chromium, the inspector page's stage views equal stage.json on disk for the adopt trial and tourney scenarios Q1 and R1, every producer and reader link lands on its run, and the flow strip shows brief, build and verify with the paths between them. Skips without Playwright.
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const TRIAL = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');

function playwright() {
  const req = createRequire(join(REPO, 'package.json'));
  for (const p of ['playwright', '/opt/node-tools/node_modules/playwright', '/opt/node22/lib/node_modules/playwright']) {
    try { return req(p); } catch { /* next */ }
  }
  return null;
}


function skipReason() {
  if (!playwright()) return 'Playwright is not installed';
  return false;
}

const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'));

/** Every folder under dir (two levels) that holds items/*.jsonl. */
function journalRoots(dir) {
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
function scenarioRoots(test, dir) {
  mkdirSync(dir, { recursive: true });
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  execFileSync(process.execPath, ['--test', join(REPO, 'packages/engine/test/tourney', test)], {
    cwd: REPO, env: { ...env, TMPDIR: dir, TMP: dir, TEMP: dir }, stdio: 'ignore', timeout: 300000
  });
  return journalRoots(dir);
}

/** Builds the page with the documented command (docs/inspector.md) from the given sources, into a fresh folder. */
function buildPage(sources, { buildScript = join(REPO, 'scripts/inspector/build.mjs'), dir = mkdtempSync(join(tmpdir(), 'isr-verify-')) } = {}) {
  writeFileSync(join(dir, 'sources.json'), JSON.stringify({ sources }));
  const out = join(dir, 'out');
  const log = execFileSync(process.execPath, [buildScript, '--config', join(dir, 'sources.json'), '--out', out, '--capture', join(dir, 'capture')], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], cwd: dirname(buildScript) });
  return { out, url: pathToFileURL(join(out, 'index.html')).href, log, dir };
}

/** The run ids the page uses, read from the built picker (DOM), so no data.js is read by the checks. */
async function pickerRuns(page) {
  return page.$$eval('#pick option', (os) => os.map((o) => ({ id: o.value, text: o.textContent })).filter((o) => o.id && !o.id.startsWith('wf:')));
}

/** The journal's run starts: engine.effect run/start rows, with the step seq and state each started in. */
function runStarts(journal, item) {
  const rows = readFileSync(join(journal, 'items', `${item}.jsonl`), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  return rows.filter((r) => r.kind === 'engine.effect' && r.payload?.type === 'run' && r.payload?.phase === 'start').map((r) => {
    let state = null; try { state = JSON.parse(r.state); } catch { /* keep null */ }
    return { run: r.payload.effect, actor: r.payload.actor, seq: Number(String(r.payload.transition).split('#').pop()), state };
  });
}

/** Every stage.json of an item, by run id. */
function stageRecords(journal, item) {
  const dir = join(journal, 'items', item, 'runs');
  const out = {};
  if (!existsSync(dir)) return out;
  for (const f of readdirSync(dir)) if (existsSync(join(dir, f, 'stage.json'))) { const s = readJson(join(dir, f, 'stage.json')); out[s.run] = s; }
  return out;
}

const seqOf = (t) => (t == null ? null : Number(String(t).split('#').pop()));
const aid = (runId) => 'run-' + String(runId).replace(/[^A-Za-z0-9_-]/g, '_');

/** In the page: turns a rendered pre.json back into the JSON text it shows. */
const DOM_TO_JSON = `(pre) => {
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
const EXTRACT_STAGES = `(domToJsonSrc) => {
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
const FOLLOW_LINKS = `async () => {
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
const EXTRACT_FLOW = `() => {
  const f = document.querySelector('#glance .flow'); if (!f) return null;
  return Array.from(f.children).map((c) => c.classList.contains('farrow') ? { arrow: c.textContent, none: c.classList.contains('none') }
    : { node: (c.querySelector('[data-goto]') || c.querySelector('b')).textContent, run: c.querySelector('[data-goto]')?.dataset.goto ?? 'start', lines: Array.from(c.querySelectorAll('.fin')).map((x) => x.textContent) });
}`;

const skip = skipReason();
let strip = null, recs = null;

before(async () => {
  if (skip) return;
  const built = buildPage([{ origin: 'v', kind: 'real', engine: '.', journal: TRIAL, label: 'trial' }]);
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(built.url + '#run=v-trial');
  strip = await page.evaluate(`(${EXTRACT_FLOW})()`);
  // Phone width too: the strip must still be there, in the same order.
  await page.setViewportSize({ width: 390, height: 844 });
  strip.narrow = await page.evaluate(`(${EXTRACT_FLOW})()`);
  strip.scroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  await browser.close();
  recs = Object.values(stageRecords(TRIAL, 'trial'));
});

const strip0 = (p) => String(p).replace(/^context\./, '');

test('flow: the strip shows brief, then build, then verify, adjacent, in that order', { skip }, () => {
  assert.ok(strip, 'no flow strip on the page');
  const nodes = strip.filter((x) => x.node);
  const at = (stage) => strip.findIndex((x) => x.node && recs.find((r) => r.run === x.run)?.stage === stage);
  const [b, u, v] = ['brief', 'build', 'verify'].map(at);
  assert.ok(b >= 0 && u > b && v > u, `order brief ${b}, build ${u}, verify ${v} in ${JSON.stringify(nodes.map((n) => n.node))}`);
  assert.equal(u - b, 2, 'build is not right after brief'); assert.equal(v - u, 2, 'verify is not right after build');
  assert.deepEqual(strip.narrow.map((x) => x.node ?? x.arrow), strip.map((x) => x.node ?? x.arrow), 'phone width differs');
  assert.equal(strip.scroll, false, 'page scrolls sideways at 390px');
});

test('flow: the arrows carry briefs.builder, pr and verdict, as stage.json wrote and readBy say', { skip }, () => {
  const by = (stage) => recs.find((r) => r.stage === stage);
  const brief = by('brief'), build = by('build'), verify = by('verify');
  // What the records say flows between each pair.
  const between = (from, to) => to.inputs.filter((i) => i.producer?.run === from.run && typeof i.from === 'string').map((i) => strip0(i.from));
  const b2u = between(brief, build), u2v = between(build, verify);
  assert.ok(b2u.includes('briefs.builder') && u2v.includes('pr'), `records: ${b2u} / ${u2v}`);
  assert.ok(brief.wrote.some((w) => w.path === 'briefs' && w.readBy.some((rb) => rb.invoke === build.invoke && rb.input === 'task')), 'brief wrote briefs read by build');
  assert.ok(build.wrote.some((w) => w.path === 'pr' && w.readBy.some((rb) => rb.invoke === verify.invoke && rb.reads === 'context.pr')), 'build wrote pr read by verify');
  const vw = verify.wrote.find((w) => w.path === 'verdict');
  assert.ok(vw && vw.readBy.length, 'verify wrote verdict with readers');
  const arrowAfter = (run) => { const k = strip.findIndex((x) => x.run === run); return strip[k + 1]?.arrow?.split(', ') ?? []; };
  assert.deepEqual(arrowAfter(brief.run).sort(), b2u.sort(), 'arrow brief -> build');
  assert.deepEqual(arrowAfter(build.run).sort(), u2v.sort(), 'arrow build -> verify');
  const next = strip[strip.findIndex((x) => x.run === verify.run) + 2];
  assert.ok(arrowAfter(verify.run).includes('verdict'), `arrow after verify: ${arrowAfter(verify.run)}`);
  // The run after verify is a reader of verdict in the record.
  assert.ok(vw.readBy.some((rb) => next.run.endsWith('.' + rb.invoke)), `${next.run} is not a reader of verdict`);
});

test('flow: each box lists every input path and the run that produced it, as the records say', { skip }, () => {
  for (const r of recs) {
    const box = strip.find((x) => x.run === r.run);
    assert.ok(box, `${r.run} has no box`);
    for (const i of r.inputs) {
      const p = i.producer ?? {};
      if (!p.run && p.kind !== 'initial') continue;
      const path = strip0(i.from);
      const fromName = p.kind === 'initial' ? 'start input' : p.actor;
      assert.ok(box.lines.some((l) => l.startsWith('← ') && l.slice(2).split(' from ')[0].split(', ').includes(path) && l.includes('from ' + fromName)), `${r.run}: no line for ${path} from ${fromName} in ${JSON.stringify(box.lines)}`);
    }
  }
});

const RUN_KINDS = ['stage', 'workflow', 'effect', 'host'];
let ctx = null;

before(async () => {
  if (skip) return;
  const tmp = mkdtempSync(join(tmpdir(), 'isr-scen-'));
  const journals = [{ journal: TRIAL, name: 'adopt trial' }];
  for (const t of ['Q1.test.js', 'R1.test.js']) for (const r of scenarioRoots(t, join(tmp, t))) journals.push({ journal: r, name: t });
  const sources = journals.map((j, n) => ({ origin: 'v', kind: n ? 'scripted' : 'real', engine: '.', journal: j.journal, label: `j${n}` }));
  const built = buildPage(sources);
  const { chromium } = playwright();
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = []; page.on('pageerror', (e) => errors.push(String(e)));
  await page.goto(built.url);
  // The page's run ids, joined to the journal and item they came from (build.mjs names a run v-j<n>[--<item>]).
  const runs = [];
  for (const [n, j] of journals.entries()) {
    const items = readdirSync(join(j.journal, 'items')).filter((f) => f.endsWith('.jsonl')).map((f) => f.slice(0, -6)).sort();
    for (const item of items) runs.push({ ...j, item, id: `v-j${n}` + (items.length > 1 ? `--${item.replace(/[^A-Za-z0-9_-]/g, '_')}` : ''), records: stageRecords(j.journal, item), starts: runStarts(j.journal, item) });
  }
  const seen = [];
  for (const r of runs) {
    await page.goto(built.url + '#run=' + encodeURIComponent(r.id));
    await page.evaluate(() => new Promise((ok) => requestAnimationFrame(() => ok())));
    const shownId = await page.$eval('#pick', (s) => s.value);
    r.shown = shownId === r.id;
    r.steps = await page.$$eval('details.step', (ds) => ds.map((d) => ({ index: Number(d.dataset.index), seq: d.querySelector('.sno').textContent })));
    r.dom = await page.evaluate(`(${EXTRACT_STAGES})(${JSON.stringify(DOM_TO_JSON)})`);
    r.links = await page.evaluate(`(${FOLLOW_LINKS})()`);
    seen.push(r);
  }
  await browser.close();
  ctx = { runs: seen, errors, built };
});
after(() => {});

const stepIndexOfSeq = (r, seq) => r.steps.find((s) => s.seq === String(seq))?.index;
const startOf = (r, run) => r.starts.find((s) => s.run === run);
const namesRun = (p, run) => !!p && (p.run === run || p.of?.run === run || (p.parts ?? []).some((x) => x.run === run));

// Checks one producer as shown (text, code, links, step jumps) against the producer in stage.json.
function checkProducer(r, p, dom, where) {
  assert.ok(p, `${where}: stage.json has no producer`);
  assert.doesNotMatch(dom.text, /not recorded/, `${where}: page says not recorded`);
  if (RUN_KINDS.includes(p.kind) && p.run) {
    const st = startOf(r, p.run);
    assert.ok(st, `${where}: producer run ${p.run} has no start row in the journal`);
    const want = stepIndexOfSeq(r, st.seq);
    assert.ok(dom.links.some((l) => l.run === p.run && l.index === want), `${where}: no link to ${p.run} (step index ${want}); links ${JSON.stringify(dom.links)}`);
    assert.ok(dom.text.includes(p.actor), `${where}: producer text "${dom.text}" does not name actor ${p.actor}`);
  } else if (p.kind === 'initial') {
    assert.match(dom.text, /start input|item's input|initial/i, `${where}: initial producer shown as "${dom.text}"`);
  } else if (p.kind === 'literal' || p.kind === 'default') {
    assert.ok(dom.codes.includes(p.at), `${where}: pointer ${p.at} not shown in "${dom.text}"`);
  } else if (p.kind === 'event') {
    assert.ok((dom.jumps ?? []).includes(stepIndexOfSeq(r, seqOf(p.transition))), `${where}: event producer has no jump to ${p.transition}`);
  } else if (p.kind === 'copy') {
    if (p.of?.run) assert.ok(dom.links.some((l) => l.run === p.of.run), `${where}: copy's source ${p.of.run} not linked`);
  } else if (p.kind === 'parts') {
    for (const x of p.parts ?? []) {
      assert.ok(dom.codes.includes(x.path), `${where}: part ${x.path} not listed`);
      if (x.run) assert.ok(dom.links.some((l) => l.run === x.run), `${where}: part writer ${x.run} not linked`);
    }
  } else assert.fail(`${where}: producer kind ${p.kind} not checked by the verifier`);
}

// The later runs of a reader the page should show (docs/inspector.md, "Output"), from the journal and stage.json.
function expectedReaderRuns(r, sj, rb) {
  const end = seqOf(sj.finished?.transition);
  const later = r.starts.filter((s) => s.run !== sj.run && s.run.split('.').pop() === rb.invoke && JSON.stringify(s.state) === JSON.stringify(rb.state) && end != null && s.seq >= end)
    .map((s) => { const rec = r.records[s.run]; const inp = rec?.inputs?.find((x) => x.name === rb.input);
      return { run: s.run, seq: s.seq, read: !rec ? null : !!inp && (namesRun(inp.producer, sj.run) || (inp.amended ?? []).some((x) => namesRun(x.by, sj.run))) }; });
  const yes = later.filter((x) => x.read === true);
  return yes.length ? yes : later.slice(0, 1);
}

test('true-to-record: the sources render, every run with stage.json has a Stage view, and the page has no errors', { skip }, () => {
  assert.equal(ctx.errors.length, 0, ctx.errors.join('\n'));
  const r1 = ctx.runs.filter((r) => r.name === 'R1.test.js'), q1 = ctx.runs.filter((r) => r.name === 'Q1.test.js');
  assert.ok(q1.length >= 1 && r1.length >= 3, `Q1 ${q1.length} runs, R1 ${r1.length}`);
  for (const r of ctx.runs) {
    assert.ok(r.shown, `${r.id} did not open`);
    const want = Object.keys(r.records).map(aid).sort();
    assert.deepEqual(r.dom.map((d) => d.box).sort(), want, `${r.id} (${r.name}, ${r.item}): Stage views vs stage.json files`);
  }
  assert.ok(ctx.runs.reduce((n, r) => n + r.dom.length, 0) >= 10, 'too few stage records to be a real check');
});

test('true-to-record: every prompt piece and its source equals stage.json', { skip }, () => {
  let n = 0;
  for (const r of ctx.runs) for (const d of r.dom) {
    const sj = Object.values(r.records).find((s) => aid(s.run) === d.box);
    assert.deepEqual(d.parts.map((p) => p.part).sort(), Object.keys(sj.prompt.parts).sort(), `${sj.run}: parts`);
    for (const p of d.parts) {
      const want = sj.prompt.parts[p.part];
      assert.equal(p.pieces.length, want.length, `${sj.run} ${p.part}: piece count`);
      p.pieces.forEach((x, k) => {
        const w = want[k], where = `${r.id} ${sj.run} ${p.part}[${k}]`; n++;
        assert.equal(x.text, w.text, `${where}: text`);
        const s = w.source;
        if (s.frame) {
          assert.match(x.cls, /src-frame/); assert.equal(x.codes[0], s.frame, `${where}: frame name`);
          if (s.fixed) assert.match(x.src, /fixed text/); if (s.filled) for (const k2 of Object.keys(s.filled)) assert.ok(x.codes.includes(k2), `${where}: filled key ${k2}`);
        } else if (s.workflow) {
          assert.match(x.cls, /src-workflow/); assert.ok(x.codes.includes(s.workflow), `${where}: pointer ${s.workflow}`);
          if (s.inlined) assert.ok(x.codes.includes(s.inlined), `${where}: inlined ${s.inlined}`);
        } else if (s.input) {
          assert.match(x.cls, /src-input/); assert.ok(x.src.includes(s.input), `${where}: input name`);
          if (typeof s.from === 'string') assert.ok(x.codes.includes(s.from), `${where}: from ${s.from}`);
          checkProducer(r, s.producer, { text: x.src, codes: x.codes, links: x.links, jumps: [] }, where);
        } else assert.fail(`${where}: unknown source ${JSON.stringify(s)}`);
      });
    }
  }
  assert.ok(n > 50, `only ${n} pieces checked`);
});

test('true-to-record: every input, its meaning, value, path, producer and later changes equals stage.json', { skip }, () => {
  let n = 0;
  for (const r of ctx.runs) for (const d of r.dom) {
    const sj = Object.values(r.records).find((s) => aid(s.run) === d.box);
    assert.deepEqual(d.inputs.map((i) => i.name), sj.inputs.map((i) => i.name), `${sj.run}: inputs`);
    d.inputs.forEach((i, k) => {
      const w = sj.inputs[k], where = `${r.id} ${sj.run} input ${w.name}`; n++;
      assert.equal(i.id, aid(sj.run) + '-in-' + w.name);
      assert.equal(i.meaning, w.meaning ?? null, `${where}: meaning`);
      const s = JSON.stringify(w.value ?? null);
      if (s.length <= 90) assert.ok(i.valueText.includes(s), `${where}: value ${s} vs "${i.valueText}"`);
      else { assert.ok(i.valueText.includes(s.slice(0, 90)), `${where}: value preview`); assert.deepEqual(JSON.parse(i.valueFull), w.value, `${where}: whole value`); }
      if (typeof w.from === 'string') assert.equal(i.fromCode, w.from, `${where}: read from`); else assert.match(i.from, /a literal in the invoke/, `${where}: literal`);
      checkProducer(r, w.producer, i.producer, where);
      assert.equal(i.amended.length, (w.amended ?? []).length, `${where}: amended count`);
      (w.amended ?? []).forEach((a, m) => { assert.equal(i.amended[m].path, a.path); checkProducer(r, a.by, i.amended[m], `${where} amended ${a.path}`); });
    });
  }
  assert.ok(n > 30, `only ${n} inputs checked`);
});

test('true-to-record: every output, stamped field, write, replaced value and reader equals stage.json', { skip }, () => {
  let writes = 0, readers = 0, replacedSeen = 0;
  for (const r of ctx.runs) for (const d of r.dom) {
    const sj = Object.values(r.records).find((s) => aid(s.run) === d.box), where = `${r.id} ${sj.run}`;
    if (!sj.finished) { assert.match(d.outText, /No finished half/, where); continue; }
    if (sj.finished.stopped) { assert.match(d.outText, /stopped it/, where); assert.equal(d.wrote.length, 0); continue; }
    assert.ok(d.took.jumps.includes(stepIndexOfSeq(r, seqOf(sj.finished.transition))), `${where}: taken-at step`);
    if ('output' in sj) { assert.deepEqual(JSON.parse(d.output), sj.output, `${where}: output`); }
    if ('error' in sj) { assert.deepEqual(JSON.parse(d.error), sj.error, `${where}: error`); }
    assert.deepEqual(d.stamped, sj.stamped ?? [], `${where}: stamped`);
    assert.equal(d.hostMarked, (sj.stamped ?? []).length, `${where}: stamped marks in the output`);
    assert.equal(d.wrote.length, sj.wrote.length, `${where}: writes`);
    sj.wrote.forEach((w, k) => {
      const x = d.wrote[k], wh = `${where} wrote ${w.path}`; writes++;
      assert.equal(x.head, 'context.' + w.path, wh);
      if (w.from) assert.ok(x.headCodes.includes(w.from), `${wh}: from`);
      if (w.at) assert.ok(x.headCodes.includes(w.at), `${wh}: at`);
      if (w.replaced) { replacedSeen++; assert.match(x.replaced.text, /^Replaced/); checkProducer(r, w.replaced, x.replaced, `${wh} replaced`); }
      else assert.match(x.replaced.text, /Replaced nothing/, `${wh}: replaced`);
      assert.equal(x.readers.length, w.readBy.length, `${wh}: readers`);
      if (!w.readBy.length) assert.ok(x.noReaders, wh);
      w.readBy.forEach((rb, m) => {
        const li = x.readers[m], wr = `${wh} reader ${rb.actor}/${rb.state}/${rb.input}`; readers++;
        assert.equal(li.bolds[0], rb.actor, `${wr}: actor`);
        assert.ok(li.codes.includes(rb.state) && li.codes.includes(rb.input), `${wr}: state and input in "${li.text}"`);
        if (rb.reads !== 'context.' + w.path) assert.ok(li.codes.includes(rb.reads), `${wr}: reads`);
        if (rb.self) assert.match(li.text, /read by itself on the next round/, wr);
        const want = expectedReaderRuns(r, sj, rb);
        assert.deepEqual(li.links.map((l) => l.run), want.map((x) => x.run), `${wr}: linked runs`);
        li.links.forEach((l, q) => {
          const e = want[q];
          assert.equal(l.index, stepIndexOfSeq(r, e.seq), `${wr}: link step`);
          if (e.read === true) assert.match(l.text, /^read it/, wr); else if (e.read === false) assert.match(l.text, /newer value|next round/, wr); else assert.match(l.text, /^started at step/, wr);
          if (rb.kind === 'stage') assert.equal(l.field, rb.input, `${wr}: link field`);
        });
        if (!want.length) assert.match(li.text, /no later (run|round) in this item/, wr);
      });
    });
  }
  assert.ok(writes >= 10 && readers >= 30, `writes ${writes}, readers ${readers}`);
});

test('true-to-record: every producer and reader link lands on the run it names, its step open', { skip }, () => {
  let n = 0;
  for (const r of ctx.runs) for (const l of r.links) {
    n++;
    const st = startOf(r, l.run), where = `${r.id}: link "${l.text}" from ${l.from} to ${l.run}`;
    assert.ok(st, `${where}: the run is not in the journal`);
    assert.equal(l.index, stepIndexOfSeq(r, st.seq), `${where}: link's step`);
    assert.equal(l.landedBox, aid(l.run), `${where}: landed on ${l.landedBox}`);
    assert.equal(l.landedStep, l.index, `${where}: landed in step ${l.landedStep}`);
    assert.ok(l.stepOpen && l.visible, `${where}: target step open ${l.stepOpen}, visible ${l.visible}`);
    if (l.field && r.records[l.run]) assert.equal(l.landedInput, aid(l.run) + '-in-' + l.field, `${where}: input box`);
  }
  assert.ok(n >= 40, `only ${n} links followed`);
});

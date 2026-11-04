// Expect true-to-record (plan/items/inspector-stage-record.md): for the adopt trial and tourney scenarios Q1 and R1,
// every piece, input, producer, write, replaced value and reader the rendered page shows equals stage.json on disk,
// and each producer and reader link lands on the run it names. Q1 and R1 are run here, on this checkout, with TMPDIR
// set to a fresh folder; the page is built with build.mjs and read in Chromium. Nothing here reads data.js.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { skipReason, playwright, buildPage, scenarioRoots, runStarts, stageRecords, seqOf, aid, DOM_TO_JSON, EXTRACT_STAGES, FOLLOW_LINKS, TRIAL } from './lib.mjs';

const skip = skipReason();
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

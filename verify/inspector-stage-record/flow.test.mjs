// Expect flow (plan/items/inspector-stage-record.md): the flow strip for the adopt trial item shows brief, then build,
// then verify, with the context paths between them (briefs.builder, pr, verdict), matching the records' wrote and
// readBy. The strip is read from the rendered DOM; what it should say is worked out here from stage.json alone.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { skipReason, playwright, buildPage, stageRecords, EXTRACT_FLOW, TRIAL } from './lib.mjs';

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

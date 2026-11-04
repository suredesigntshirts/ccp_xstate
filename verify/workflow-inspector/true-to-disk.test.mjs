// Expect true-to-disk (plan/items/workflow-inspector.md): for fri-jsonl-lint-2 and lane A and C scenario Q1, every
// prompt, added context, schema, result and trace row the rendered page shows equals the files on disk, and each
// prompt's source label is the true one, checked against actors.js of that engine.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { skipReason, buildPage, playwright, DOM_TO_JSON, readJson, readText, embeddedJson, writtenBriefOf, REPO, FRI, LANE_A, LANE_C } from './lib.mjs';

const skip = skipReason();

// What the page shows for every model actor of the open run, read from the DOM only.
const EXTRACT = (domToJsonSrc) => {
  const domToJson = new Function('return ' + domToJsonSrc)();
  document.querySelectorAll('details').forEach((d) => { d.open = true; });
  const layer = (actor, n) => Array.from(actor.querySelectorAll('details.layer')).find((d) => d.querySelector('summary .lnum')?.textContent === String(n));
  return Array.from(document.querySelectorAll('#steps .actor')).filter((a) => /model agent/.test(a.querySelector('header')?.textContent || '')).map((a) => {
    const folder = Array.from(a.querySelectorAll('p.small')).find((p) => /Run folder:/.test(p.textContent))?.querySelector('code')?.textContent;
    const l2 = layer(a, 2), l3 = layer(a, 3), l4 = layer(a, 4), l5 = layer(a, 5), l6 = layer(a, 6), l7 = layer(a, 7);
    const inputPre = a.querySelector('pre[aria-label="actor input"]');
    const schemaPre = l4.querySelector('pre[aria-label="output schema shown to the agent"]');
    const hostSchemaPre = l4.querySelector('pre[aria-label="host schema"]');
    const resultPre = l6.querySelector('pre[aria-label="stored result"]');
    return {
      actor: a.querySelector('header h4').textContent,
      folder,
      who: l2.querySelector('.who b')?.textContent,
      whoText: l2.querySelector('.who')?.textContent,
      prompt: l2.querySelector('pre[data-v="raw"]')?.textContent ?? null,
      segs: Array.from(l2.querySelectorAll('pre.seg > span')).map((s) => ({ from: s.className.replace('seg-', ''), text: s.textContent })),
      context: l3.querySelector('pre[data-v="raw"]')?.textContent ?? null,
      input: inputPre ? domToJson(inputPre) : null,
      schema: schemaPre ? domToJson(schemaPre) : null,
      hostSchema: hostSchemaPre ? domToJson(hostSchemaPre) : null,
      result: resultPre ? domToJson(resultPre) : null,
      hostMarked: Array.from(l6.querySelectorAll('.onlylist li code')).map((c) => c.textContent),
      trace: Array.from(l5.querySelectorAll('tbody tr')).map((tr) => Array.from(tr.children).map((td) => td.textContent.trim())),
      l5text: l5.textContent,
      l1text: layer(a, 1).textContent,
      verdicts: Array.from(l7.querySelectorAll('.verdict')).map((v) => ({ cls: v.className, text: v.textContent }))
    };
  });
};

// Text labelled actor input: part of the input's JSON, or a JSON object whose every entry is the input's.
function inInput(text, input) {
  const all = JSON.stringify(input);
  if (all.includes(text)) return true;
  try { const v = JSON.parse(text); return v && typeof v === 'object' && Object.entries(v).every(([k, x]) => JSON.stringify(input?.[k]) === JSON.stringify(x)); } catch { return false; }
}

function sessionRows(journal, agentId) {
  const dir = join(journal, 'sessions');
  if (!existsSync(dir)) return [];
  const rows = [];
  for (const f of readdirSync(dir)) if (f.endsWith('.jsonl')) for (const l of readFileSync(join(dir, f), 'utf8').split('\n')) if (l.trim()) rows.push(JSON.parse(l));
  const seen = new Set();
  return rows.filter((r) => r.agent === agentId && r.kind !== 'hook.run').filter((r) => { if (seen.has(r.id)) return false; seen.add(r.id); return true; });
}

function itemRows(journal, item) { return readFileSync(join(journal, 'items', item + '.jsonl'), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); }

/** The result field of an earlier model run of the same item whose text equals `text`. */
// result.json is the host's record { result, hash, caller, toolUseId, at }; its result is what the agent's answer became.
const storedResult = (j) => (j && typeof j === 'object' && 'result' in j && 'hash' in j ? j.result : j);

function producerOf(runsDir, text) {
  for (const d of readdirSync(runsDir)) {
    const r = join(runsDir, d, 'result.json');
    if (!existsSync(r)) continue;
    const v = storedResult(readJson(r));
    for (const [k, x] of Object.entries(v ?? {})) if (x === text) return { run: d, field: k, actor: readJson(join(runsDir, d, 'run.json')).actor };
  }
  return null;
}

function checkActor(m, { engine, journal, scripted, problems }) {
  const where = `${m.actor} @ ${m.folder}`;
  const fail = (what) => problems.push(`${where}: ${what}`);
  const brief = readText(join(m.folder, 'brief.md'));
  const context = readText(join(m.folder, 'context.md'));
  const run = readJson(join(m.folder, 'run.json'));
  const result = existsSync(join(m.folder, 'result.json')) ? storedResult(readJson(join(m.folder, 'result.json'))) : null;
  // Layer 2: the prompt byte for byte, and its coloured pieces put back together.
  if (m.prompt !== brief) fail('layer 2 "original" text differs from brief.md');
  if (m.segs.map((s) => s.text).join('') !== brief) fail('layer 2 coloured segments do not join to brief.md');
  // Layer 3.
  if (m.context !== context) fail('layer 3 text differs from context.md');
  // Input.
  try { assert.deepEqual(JSON.parse(m.input), run.input); } catch { fail('actor input differs from run.json input'); }
  // Layer 4: the schema in the page is the one embedded in context.md; if it differs from run.json's, both shown.
  const shown = JSON.parse(m.schema);
  if (!embeddedJson(context).some((v) => JSON.stringify(v) === JSON.stringify(shown))) fail('layer 4 schema is not the schema in context.md');
  if (JSON.stringify(shown) !== JSON.stringify(run.schema)) {
    if (!m.hostSchema) fail('layer 4 schema differs from run.json schema and the host schema is not shown');
    else try { assert.deepEqual(JSON.parse(m.hostSchema), run.schema); } catch { fail('layer 4 host schema differs from run.json schema'); }
  }
  // Layer 6: result.json.
  if (result == null) { if (m.result != null) fail('layer 6 shows a result but there is no result.json'); }
  else try { assert.deepEqual(JSON.parse(m.result), result); } catch { fail('layer 6 differs from result.json'); }
  // Layer 5: the trace rows equal the live-capture rows of this agent (none for scripted runs).
  const agent = existsSync(join(m.folder, 'agent.json')) ? readJson(join(m.folder, 'agent.json')).agentId : null;
  const rows = agent ? sessionRows(journal, agent) : [];
  if (scripted) {
    if (m.trace.length) fail('scripted run shows trace rows');
    if (!/no model ran/i.test(m.l1text)) fail('scripted run layer 1 does not say no model ran');
  } else {
    if (m.trace.length !== rows.length) fail(`layer 5 has ${m.trace.length} rows, the capture has ${rows.length} for agent ${agent}`);
    const want = rows.map((r) => [r.at.slice(11, 19), r.kind === 'tool.call' ? r.payload.tool : r.kind, r.payload?.ms != null ? String(r.payload.ms) : null, r.payload?.inputBytes != null ? String(r.payload.inputBytes) : null]).map((x) => JSON.stringify(x)).sort();
    const got = m.trace.map((t) => [t[0], t[2].replace(/.*\((\S+)\)$/, '$1'), /^\d+$/.test(t[4]) ? t[4] : null, /^\d+$/.test(t[5]) ? t[5] : null]).map((x) => JSON.stringify(x)).sort();
    try { assert.deepEqual(got, want); } catch { fail(`layer 5 rows differ from the capture:\n got ${got.join('\n     ')}\n want ${want.join('\n      ')}`); }
  }
  // Layer 7: every accept or refuse row of this run in the journal is shown, and no other.
  const verdictOf = (r) => (r.kind === 'result.stored' || r.kind === 'result.accepted' ? 'accepted' : r.kind === 'refusal' || /refus/.test(r.kind) ? 'refused' : null);
  const jr = itemRows(journal, run.item).filter((r) => r.payload?.run === run.run && verdictOf(r)).map((r) => ({ ...r, verdict: verdictOf(r) }));
  const shownV = m.verdicts.filter((v) => /\b(accepted|refused)\b/.test(v.cls));
  if (shownV.length !== jr.length) fail(`layer 7 shows ${shownV.length} accept/refuse rows, the journal has ${jr.length}`);
  for (const r of jr) if (!shownV.some((v) => v.cls.includes(r.verdict) && v.text.includes(r.at.slice(0, 19).replace('T', ' ')) && v.text.includes(r.kind))) fail(`layer 7 lacks ${r.verdict} ${r.kind} at ${r.at}`);
  // Who wrote the prompt: worked out here from the files and the engine's own code.
  const runsDir = join(m.folder, '..');
  if (typeof run.input?.brief === 'string' && run.input.brief) {
    if (run.input.brief !== brief) fail('input.brief differs from brief.md');
    const p = producerOf(runsDir, brief);
    if (!p) fail('passthrough brief: no earlier result.json field holds it');
    else {
      if (!m.who.includes(`the ${p.actor} agent`)) fail(`label "${m.who}" does not name the ${p.actor} agent`);
      if (scripted && !/test fixture/.test(m.who)) fail(`scripted passthrough label "${m.who}" does not say test fixture`);
      if (!m.whoText.includes(p.field)) fail(`label does not name the ${p.field} field it came from`);
    }
    if (m.segs.some((s) => s.from !== 'passthrough')) fail('passthrough prompt has non-passthrough segments');
  } else {
    const wb = writtenBriefOf(engine);
    if (!wb) fail('engine has no writtenBrief');
    else if (wb.fn(run.actor, run.input) !== brief) fail('brief.md is not writtenBrief(actor, input) of this engine');
    const src = readFileSync(join(engine, 'packages/engine/src/actors.js'), 'utf8');
    const [wname, wsha] = String(run.workflow).split('@');
    const blob = wsha ? join(journal, 'blobs', wsha) : null;
    const spec = blob && existsSync(blob) ? readJson(blob) : readJson(join(engine, 'workflows', wname + '.json'));
    const literals = [];
    const walk = (n) => { if (n && typeof n === 'object') { for (const [k, v] of Object.entries(n)) { if (k === 'invoke') for (const i of [].concat(v)) for (const x of Object.values(i.input ?? {})) if (x && typeof x === 'object' && typeof x.value === 'string') literals.push(x.value); walk(v); } } };
    walk(spec);
    const used = literals.filter((l) => brief.includes(l));
    if (used.length) { if (!/workflow author/.test(m.who)) fail(`prompt carries workflow JSON text but label is "${m.who}"`); }
    else if (!/^Who wrote this prompt: nobody/.test(m.who)) fail(`bare template prompt labelled "${m.who}"`);
    for (const s of m.segs) {
      if (s.from === 'template' && !src.includes(s.text) && !wb?.src.includes(s.text)) fail(`segment labelled template is not literal engine code: ${JSON.stringify(s.text)}`);
      if (s.from === 'workflow' && !literals.some((l) => l.includes(s.text))) fail(`segment labelled workflow is not in the workflow JSON: ${JSON.stringify(s.text)}`);
      if (s.from === 'input' && !inInput(s.text, run.input)) fail(`segment labelled input is not in the input: ${JSON.stringify(s.text)}`);
      if (s.from === 'passthrough') fail('template prompt has a passthrough segment');
    }
    // The bare template part (actor name aside) is all template-coloured.
    const tSegs = m.segs.filter((s) => s.from === 'template').map((s) => s.text).join('');
    if (!tSegs.includes('You are the ')) fail('the template opening is not labelled template');
  }
  return { where, label: m.who, folder: m.folder };
}

test('true-to-disk: each model step of fri-jsonl-lint-2 and lane A and C Q1 equals the files on disk', { skip, timeout: 300000 }, async () => {
  const { url } = buildPage();
  const { chromium } = playwright();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    await page.goto(url);
    const opts = await page.$$eval('#pick option', (os) => os.map((o) => ({ v: o.value, t: o.textContent })));
    const targets = [
      { find: (o) => /fri-jsonl-lint-2/.test(o.t), engine: REPO, scripted: false, journal: FRI },
      { find: (o) => /^Lane A/.test(o.t) && /Q1/.test(o.t), engine: LANE_A, scripted: true },
      { find: (o) => /^Lane C/.test(o.t) && /Q1/.test(o.t), engine: LANE_C, scripted: true }
    ];
    const problems = []; const seen = [];
    for (const t of targets) {
      const runs = opts.filter(t.find);
      assert.ok(runs.length, `no run in the picker for ${t.engine}`);
      for (const o of runs) {
        await page.goto(url + '#run=' + encodeURIComponent(o.v));
        await page.reload();
        const ms = await page.evaluate(EXTRACT, DOM_TO_JSON.toString());
        assert.ok(ms.length >= 3, `${o.t}: only ${ms.length} model steps rendered`);
        for (const m of ms) {
          const journal = t.journal ?? m.folder.split('/items/')[0];
          seen.push(`${o.t.slice(0, 40)} | ${checkActor(m, { engine: t.engine, journal, scripted: t.scripted, problems }).label}`);
        }
      }
    }
    console.log(seen.join('\n'));
    assert.deepEqual(problems, []);
  } finally { await browser.close(); }
});

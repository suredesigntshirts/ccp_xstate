// Verifier's check for Expect catalogue (plan item prompt-catalogue). instrument.diff, applied to a scratch clone at
// the PR head and committed there (so setup.sh's git-archive copies carry it), makes messages.js log every render
// (entry, values, text) to render.jsonl, actors.js log every assembled prompt with its parts to brief.jsonl, and the
// hook scripts actors.mjs, session-start.mjs, notice-behind.mjs and return-tool.mjs log every stdout write to
// hook.jsonl. After `npm test` there, this script reads the logs and matches every model-facing output to a render
// of a named entry of the harness catalogue: node catalogue-check.mjs <log dir>.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = process.argv[2];
const lines = (f) => { try { return readFileSync(join(dir, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)); } catch { return []; } };
const renders = lines('render.jsonl').filter((r) => String(r.file).endsWith('engine/messages.md'));
const byText = new Map();
for (const r of renders) byText.set(r.text, [...new Set([...(byText.get(r.text) ?? []), r.entry])]);
const report = { renders: renders.length, entriesRendered: [...new Set(renders.map((r) => r.entry))].sort(), hookOutputs: 0, texts: 0, matched: 0, unmatched: [], prompts: 0, briefs: 0, briefPieces: 0, briefProblems: [] };
const prompts = new Set();
for (const b of lines('brief.jsonl')) {
  report.briefs++;
  prompts.add(b.prompt);
  const order = ['rules', 'inputs', 'task', 'output', 'return'];
  for (const part of order) {
    for (const p of b.parts[part] ?? []) {
      report.briefPieces++;
      if (p.source?.entry) {
        if (!(byText.get(p.text) ?? []).includes(p.source.entry)) report.briefProblems.push({ part, entry: p.source.entry, text: p.text.slice(0, 200), why: 'not a render of its entry' });
      } else if (!(part === 'task' && p.source?.input === 'task')) report.briefProblems.push({ part, source: p.source, text: String(p.text).slice(0, 200), why: 'piece with no entry that is not the task input' });
    }
  }
  // The frame glue: headings (entries) then pieces, a newline apart, parts a blank line apart.
  const headings = order.map((p) => renders.find((r) => r.entry === `heading-${p}`)?.text);
  const want = order.map((p, i) => [headings[i], ...(b.parts[p] ?? []).map((x) => x.text)].join('\n')).join('\n\n');
  if (want !== b.prompt) report.briefProblems.push({ why: 'prompt is not headings + pieces', text: b.prompt.slice(0, 200) });
}
const check = (where, text) => {
  report.texts++;
  if (byText.has(text)) report.matched++;
  else report.unmatched.push({ where, text: String(text).slice(0, 300) });
};
for (const h of lines('hook.jsonl')) {
  for (const l of String(h.out).split('\n').filter((x) => x.trim())) {
    let o;
    try { o = JSON.parse(l); } catch { report.unmatched.push({ where: h.script, text: `not JSON: ${l.slice(0, 200)}` }); continue; }
    report.hookOutputs++;
    const script = h.script.replace(/^.*\/scripts\//, '');
    const s = o.hookSpecificOutput;
    if (s?.permissionDecisionReason !== undefined) check(`${script} ${s.hookEventName} deny`, s.permissionDecisionReason);
    if (s?.additionalContext !== undefined) check(`${script} ${s.hookEventName} additionalContext`, s.additionalContext);
    if (o.decision === 'block') check(`${script} block`, o.reason);
    if (s?.updatedInput?.prompt !== undefined) { report.prompts++; if (!prompts.has(s.updatedInput.prompt)) report.unmatched.push({ where: `${script} Agent prompt`, text: s.updatedInput.prompt.slice(0, 200) }); }
    if (o.jsonrpc && o.result?.tools) for (const t of o.result.tools) { check(`${script} tool description`, t.description); for (const [k, p] of Object.entries(t.inputSchema?.properties ?? {})) check(`${script} ${k} description`, p.description); }
    if (o.jsonrpc && o.result?.content) for (const c of o.result.content) check(`${script} tool answer`, c.text);
  }
}
console.log(JSON.stringify(report, null, 1));

// Sums up record.mjs output files into the JSON blocks the evidence files carry.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const CHEAP = 'cheap: hook.run rows show at most 50 ms median and 200 ms p95 over a bare node start per tool call';
const load = (f) => JSON.parse(readFileSync(f, 'utf8'));
const pass = (p) => {
  const top = p.rows.filter((r) => r.nesting === 0);
  return { command: p.command, start: p.start, end: p.end, code: p.code, files: new Set(top.map((r) => r.file)).size, tests: top.length,
    fail: top.filter((r) => r.status === 'fail').map((r) => `${r.file} :: ${r.name}`), cheap: top.filter((r) => r.name === CHEAP).map((r) => r.status), failMsgs: p.failMsgs };
};
const run = (d) => ({ label: d.label, sha: d.sha, passes: d.runs.map(pass) });
const keyed = (p) => {
  const seen = {}; const m = new Map();
  for (const r of p.rows.filter((r) => r.nesting === 0)) { const k = `${r.file} :: ${r.name}`; seen[k] = (seen[k] ?? 0) + 1; m.set(seen[k] > 1 ? `${k} #${seen[k]}` : k, r.status); }
  return m;
};
const fileSet = (p) => [...new Set(p.rows.map((r) => r.file))].sort();
const hash = (xs) => createHash('sha256').update(xs.join('\n')).digest('hex');
const [what, ...files] = process.argv.slice(2);
if (what === 'runs') console.log(JSON.stringify({ runs: files.map((f) => run(load(f))) }, null, 1));
if (what === 'compare') {
  const [b, h] = files.map(load);
  const bk = keyed(b.runs[0]); const hk = keyed(h.runs[0]);
  const bf = fileSet(b.runs[0]); const hf = fileSet(h.runs[0]);
  const added = hf.filter((f) => !bf.includes(f)); const missing = bf.filter((f) => !hf.includes(f));
  const changed = [...new Set([...bk.keys(), ...hk.keys()])].filter((k) => !added.some((f) => k.startsWith(`${f} :: `))).filter((k) => bk.get(k) !== hk.get(k)).map((k) => ({ key: k, base: bk.get(k) ?? 'absent', head: hk.get(k) ?? 'absent' }));
  const side = (d, k) => ({ sha: d.sha, code: d.runs[0].code, files: fileSet(d.runs[0]).length, filesHash: hash(fileSet(d.runs[0])), tests: k.size });
  console.log(JSON.stringify({ base: side(b, bk), head: side(h, hk), added, missing, changed, flaky: [] }, null, 1));
}

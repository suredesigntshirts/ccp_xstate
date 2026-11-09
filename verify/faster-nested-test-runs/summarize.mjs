// Turns record.mjs's summary.json into the json blocks evidence/same-tests.md, faster.md and no-leak.md hold.
// Usage: node summarize.mjs <out>/summary.json  (prints the three blocks as one JSON object)
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { FILES } from './lib.mjs';

const s = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const r0 = s.rounds[0];
const names = (run) => run.tests.map((x) => `${x.depth}:${x.name}`).sort();
const digest = (xs) => createHash('sha256').update(xs.join('\n')).digest('hex').slice(0, 16);
const files = {};
for (const f of FILES) {
  const b = r0.base[f], h = r0.head[f];
  const nb = names(b), nh = names(h);
  const skippedB = new Set(b.tests.filter((x) => x.skip).map((x) => x.name));
  files[f] = {
    base: { code: b.code, names: nb.length, pass: b.pass, fail: b.fail, skipped: b.skipped, digest: digest(nb) },
    head: { code: h.code, names: nh.length, pass: h.pass, fail: h.fail, skipped: h.skipped, digest: digest(nh) },
    onlyBase: nb.filter((n) => !nh.includes(n)), onlyHead: nh.filter((n) => !nb.includes(n)),
    skippedNow: h.tests.filter((x) => x.skip && !skippedB.has(x.name)).map((x) => x.name),
  };
}
const median = (xs) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rounds = s.rounds.map((r) => ({
  first: r.order[0], files: Object.keys(r.head).length,
  base_ms: FILES.reduce((a, f) => a + r.base[f].ms, 0), head_ms: FILES.reduce((a, f) => a + r.head[f].ms, 0),
}));
const perFile = Object.fromEntries(FILES.map((f) => [f, { base_ms: median(s.rounds.map((r) => r.base[f].ms)), head_ms: median(s.rounds.map((r) => r.head[f].ms)) }]));
const faster = { base: s.base, head: s.head, rounds, base_median_ms: median(rounds.map((r) => r.base_ms)), head_median_ms: median(rounds.map((r) => r.head_ms)), perFile };
const leaks = (side) => Object.fromEntries(FILES.map((f) => [f, [...new Set(s.rounds.flatMap((r) => Object.keys(r[side][f].leak)))]]));
const noLeak = { head: s.head, headLeaks: leaks('head'), baseLeaks: Object.fromEntries(Object.entries(leaks('base')).filter(([, v]) => v.length)) };
console.log(JSON.stringify({ sameTests: { base: s.base, head: s.head, files }, faster, noLeak }, null, 1));

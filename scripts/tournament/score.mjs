#!/usr/bin/env node
// Scores a tournament floors first, then on trade-offs (plan item tournament-scoring-floors, docs/tournaments.md).
//
//   node scripts/tournament/score.mjs tournaments/<id> [--judge <file>] [--scores <file>] [--out <dir>]
//
// Reads <folder>/config.json (scoring.floors and scoring.tradeoffs), <folder>/scores.json (measure.mjs's output per
// lane) and the judge's file (<folder>/judge.json by default: the judge schema's output, one entry per lane with its
// floors, model stages, primitives and trials). Writes <out>/scoring.json and <out>/scoring.md (out defaults to the
// folder) and prints the Markdown.
//
// 1. Floors. A lane qualifies only if the judge reports every floor the config names as passed. A floor the judge
//    leaves out counts as failed, and each failed floor is named.
// 2. Primitives. A primitive counts only if every one of the lane's model stages uses it and it is used in more than
//    one workflow. Every other primitive is listed as a special case with the reason, never dropped.
// 3. Trade-offs. Qualified lanes are laid side by side on every trade-off. A lane ranks above another only if it is
//    at least as good on every trade-off and better on one (Pareto dominance), so no single count decides; lanes
//    neither dominates share a tier, and the table shows why.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkScoring, ConfigError, FLOOR_KINDS, floorId } from './args.mjs';

const readJson = (f, what) => {
  if (!fs.existsSync(f)) throw new ConfigError(`${what} ${f} not found`);
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch (e) {
    throw new ConfigError(`${f}: ${e.message}`);
  }
};
const get = (o, p) => p.split('.').reduce((v, k) => (v == null ? undefined : v[k]), o);
const workflowOf = (stage) => String(stage).split('/')[0];

/** Applies the counting rule to one lane's primitives. */
export function countPrimitives(primitives = [], modelStages = []) {
  const counted = [];
  const special = [];
  for (const p of primitives) {
    const stages = p.stages || [];
    const workflows = new Set([...stages.map(workflowOf), ...(p.workflows || [])]);
    const missing = modelStages.filter((s) => !stages.includes(s));
    const why = [];
    if (modelStages.length === 0) why.push('the judge listed no model stages for this lane');
    else if (missing.length === modelStages.length) why.push('used by no model stage');
    else if (missing.length) why.push(`used by ${modelStages.length - missing.length} of ${modelStages.length} model stages (not ${missing.join(', ')})`);
    if (workflows.size < 2) why.push(workflows.size ? `used in one workflow (${[...workflows][0]})` : 'used in no workflow the judge named');
    const entry = { name: p.name, weight: p.weight ?? 1, ...(p.note && { note: p.note }) };
    if (why.length) special.push({ ...entry, why: why.join('; ') });
    else counted.push(entry);
  }
  return { count: counted.length, weighted: counted.reduce((n, p) => n + p.weight, 0), counted, special };
}

/** Checks one lane's judge entry against the config's floors; returns the failed floors, named. */
export function checkFloors(floors, entry) {
  const failed = [];
  for (const kind of FLOOR_KINDS) {
    for (const f of floors[kind] || []) {
      const id = floorId(f);
      const r = (entry?.floors || []).find((x) => x.kind === kind && x.id === id);
      if (!r) failed.push({ kind, id, why: 'not reported by the judge' });
      else if (r.pass !== true) failed.push({ kind, id, why: r.evidence || 'failed' });
    }
  }
  return failed;
}

/** One lane's value on one trade-off, and its text for the table. */
function tradeoffValue(t, entry, measures) {
  if (t.kind === 'primitives') {
    const p = countPrimitives(entry.primitives, entry.modelStages);
    return { value: p.weighted, better: 'lower', text: `${p.count} counted (${p.weighted} weighted), ${p.special.length} special`, detail: p };
  }
  if (t.kind === 'trials') {
    const list = entry.trials || [];
    const passed = list.filter((x) => x.passed === true).length;
    return { value: passed, better: 'higher', text: `${passed} passed of ${list.length}`, detail: list };
  }
  const v = get(measures, t.measure);
  return { value: typeof v === 'number' ? v : null, better: t.better, text: typeof v === 'number' ? String(v) : 'not measured' };
}

/** -1 if a is better, 1 if b is better, 0 if equal, null if either is missing. */
function cmp(a, b, better) {
  if (a == null || b == null) return a == null && b == null ? 0 : null;
  if (a === b) return 0;
  return (better === 'lower' ? a < b : a > b) ? -1 : 1;
}

/** True if lane a is at least as good as b on every trade-off and better on at least one. */
function dominates(a, b, tradeoffs) {
  let better = false;
  for (const t of tradeoffs) {
    const c = cmp(a[t.id].value, b[t.id].value, a[t.id].better);
    if (c === null || c === 1) return false;
    if (c === -1) better = true;
  }
  return better;
}

/** Scores a tournament from its parsed config, scores.json and judge file. */
export function score({ config, scores, judge }) {
  const s = checkScoring(config.scoring);
  const laneOf = (key) => config.lanes.find((l) => l.id === key || l.alias === key);
  const entries = {};
  for (const e of judge.scores || judge.lanes || []) {
    const l = laneOf(e.lane);
    if (!l) throw new ConfigError(`judge file names lane ${e.lane}, which is not in config.lanes`);
    entries[l.id] = e;
  }

  const floors = {};
  for (const l of config.lanes) {
    const failed = entries[l.id] ? checkFloors(s.floors, entries[l.id]) : [{ kind: 'judge', id: l.id, why: 'the judge file has no entry for this lane' }];
    floors[l.id] = { qualified: failed.length === 0, failed };
  }
  const qualified = config.lanes.map((l) => l.id).filter((id) => floors[id].qualified);

  const table = {};
  for (const id of qualified) {
    table[id] = {};
    for (const t of s.tradeoffs) table[id][t.id] = tradeoffValue(t, entries[id], scores?.lanes?.[id]?.measures || {});
  }
  const beats = Object.fromEntries(qualified.map((id) => [id, qualified.filter((o) => o !== id && dominates(table[id], table[o], s.tradeoffs))]));
  const tiers = [];
  let left = [...qualified];
  while (left.length) {
    const tier = left.filter((id) => !left.some((o) => o !== id && beats[o].includes(id)));
    tiers.push(tier);
    left = left.filter((id) => !tier.includes(id));
  }

  return {
    tournament: config.id,
    scoredAt: new Date().toISOString(),
    rule: 'Floors first: a lane qualifies only if it passes every floor. Then qualified lanes are laid side by side on every trade-off; a lane ranks above another only if it is at least as good on all of them and better on one.',
    floors,
    qualified,
    notQualified: config.lanes.map((l) => l.id).filter((id) => !floors[id].qualified),
    tradeoffs: s.tradeoffs.map((t) => ({ id: t.id, kind: t.kind, ...(t.measure && { measure: t.measure }), better: t.kind === 'primitives' ? 'lower' : t.kind === 'trials' ? 'higher' : t.better })),
    table,
    beats,
    tiers
  };
}

const esc = (v) => String(v).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** The scoring result as Markdown. */
export function markdown(r) {
  const out = [`# Scoring: ${r.tournament}`, '', r.rule, '', '## Floors', '', '| Lane | Qualified | Failed floors |', '|---|---|---|'];
  for (const [id, f] of Object.entries(r.floors))
    out.push(`| ${id} | ${f.qualified ? 'yes' : 'no'} | ${f.failed.map((x) => `${x.kind} ${x.id}: ${esc(x.why)}`).join('; ') || ''} |`);
  out.push('', '## Trade-offs (qualified lanes only)', '');
  if (!r.qualified.length) out.push('No lane qualified.');
  else {
    out.push(`| Lane | ${r.tradeoffs.map((t) => `${t.id} (${t.better} is better)`).join(' | ')} | Ranks above |`);
    out.push(`|---|${r.tradeoffs.map(() => '---').join('|')}|---|`);
    for (const id of r.qualified) out.push(`| ${id} | ${r.tradeoffs.map((t) => esc(r.table[id][t.id].text)).join(' | ')} | ${r.beats[id].join(', ') || 'none'} |`);
    out.push('', `Tiers (tier 1 holds the lanes no other qualified lane beats; each later tier holds lanes beaten only by lanes in earlier tiers): ${r.tiers.map((t, i) => `${i + 1}. ${t.join(', ')}`).join('  ')}`);
    for (const t of r.tradeoffs.filter((x) => x.kind === 'primitives')) {
      for (const id of r.qualified) {
        const d = r.table[id][t.id].detail;
        out.push('', `### ${id}: ${t.id}`, '', `Counted: ${d.counted.map((p) => (p.weight === 1 ? p.name : `${p.name} (×${p.weight})`)).join(', ') || 'none'}`, '');
        out.push(d.special.length ? 'Special cases (not counted):' : 'Special cases: none');
        for (const p of d.special) out.push(`- ${p.name}: ${p.why}`);
      }
    }
  }
  return out.join('\n') + '\n';
}

/** Scores a tournament folder and writes scoring.json and scoring.md. */
export function scoreFolder(folder, { judge, scores, out } = {}) {
  const config = readJson(path.join(folder, 'config.json'), 'the config');
  const scoresFile = scores || path.join(folder, 'scores.json');
  const r = score({
    config,
    scores: fs.existsSync(scoresFile) ? readJson(scoresFile, 'scores') : { lanes: {} },
    judge: readJson(judge || path.join(folder, 'judge.json'), "the judge's file")
  });
  const dir = out || folder;
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'scoring.json'), JSON.stringify(r, null, 2) + '\n');
  const md = markdown(r);
  fs.writeFileSync(path.join(dir, 'scoring.md'), md);
  return { result: r, markdown: md };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2);
  const opt = (k) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : undefined);
  const folder = argv[0];
  if (!folder || folder.startsWith('--')) {
    console.error('usage: node scripts/tournament/score.mjs tournaments/<id> [--judge <file>] [--scores <file>] [--out <dir>]');
    process.exit(2);
  }
  try {
    process.stdout.write(scoreFolder(folder, { judge: opt('--judge'), scores: opt('--scores'), out: opt('--out') }).markdown);
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    console.error(`score: refused: ${e.message}`);
    process.exit(1);
  }
}

// Evidence for Expect line page (the Stage view and flow strip as on main): node compare-main.mjs <main clone> <head clone>
// exports the four stage-contract trials on both and compares each model run's Stage view, the flow strip and
// every step's taken way out (from, to), with checkout paths blanked.
import { pathToFileURL } from 'node:url';
const [M, H] = process.argv.slice(2);
const em = await import(pathToFileURL(`${M}/scripts/inspector/export.mjs`).href);
const eh = await import(pathToFileURL(`${H}/scripts/inspector/export.mjs`).href);
const roots = ['adopt', 'blocked-retry', 'fail', 'blocked'].map((t) => `tournaments/2026-11-04-stage-contract/trials/${t}/journal`);
let n = 0;
const diffs = [];
for (const r of roots) {
  const a = await em.exportRun({ engine: M, journal: `${M}/${r}` });
  const b = await eh.exportRun({ engine: H, journal: `${H}/${r}` });
  const fix = (x) => JSON.stringify(x).replaceAll(M, 'R').replaceAll(H, 'R');
  if (fix(a.flow) !== fix(b.flow)) diffs.push(`${r} flow`);
  const sa = a.steps.flatMap((s) => s.actors.filter((x) => x.stage).map((x) => x.stage));
  const sb = b.steps.flatMap((s) => s.actors.filter((x) => x.stage).map((x) => x.stage));
  n += sa.length;
  if (fix(sa) !== fix(sb)) diffs.push(`${r} stage`);
  if (fix(a.steps.map((s) => s.edge && [s.edge.from, s.edge.to])) !== fix(b.steps.map((s) => s.edge && [s.edge.from, s.edge.to]))) diffs.push(`${r} edges`);
}
console.log(`trials ${roots.length}, stage views compared ${n}, differences: ${diffs.length ? diffs.join('; ') : 'none'}`);

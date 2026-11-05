// The stalls view (plan item fix-waiting-run-stall): how often a session ended a turn with one of its runs prepared
// and no agent, and what came of it. It reads the rows the stall guard writes (refusal rows with rule stall,
// stall-cap or cannot-start; packages/engine/src/actors.js stall and cannotStart), the brief.stored row each prepared
// run has, and the agent.spawn row that binds a run's agent. It writes nothing. docs/journal.md, "Derived views".

const runOf = (r) => r.payload?.run ?? null;

/**
 * The stalls view over `rows` (any order, any mix). Returns { prepared, blocked, blocks, startedAfterBlock,
 * failedAtCap, cannotStart, rate, runs }: prepared counts runs with a brief.stored row; blocked counts runs blocked
 * at least once, blocks every block; startedAfterBlock counts blocked runs whose agent.spawn row is later than their
 * first block; rate is blocked / prepared (0 with none prepared). runs lists every prepared run and every run the
 * guard touched.
 * A row read twice (the same id) counts once.
 */
export function stalls(rows) {
  const seen = new Set();
  const unique = rows.filter((r) => r && !seen.has(r.id) && seen.add(r.id)).toSorted((a, b) => (a.at < b.at ? -1 : a.at > b.at ? 1 : 0));
  const prepared = new Set(unique.filter((r) => r.kind === 'brief.stored' && runOf(r)).map(runOf));
  const runs = new Map();
  const entry = (r) => {
    const run = runOf(r);
    if (!runs.has(run)) runs.set(run, { run, item: r.item ?? null, actor: r.payload?.actor ?? null, blocks: 0, firstBlockAt: null, startedAfterBlock: false, failed: null });
    return runs.get(run);
  };
  // Every prepared run gets an entry, blocked or not, so the view lists each run it counted.
  for (const r of unique.filter((r) => r.kind === 'brief.stored' && runOf(r))) entry(r);
  for (const r of unique.filter((r) => r.kind === 'refusal' && runOf(r))) {
    const rule = r.payload.rule;
    if (rule === 'stall') {
      const e = entry(r);
      e.blocks += 1;
      e.firstBlockAt ??= r.at;
    } else if (rule === 'stall-cap' || rule === 'cannot-start') {
      entry(r).failed ??= rule;
    }
  }
  for (const r of unique.filter((r) => r.kind === 'agent.spawn' && runs.has(runOf(r)))) {
    const e = runs.get(runOf(r));
    if (e.firstBlockAt && r.at >= e.firstBlockAt) e.startedAfterBlock = true;
  }
  const list = [...runs.values()].sort((a, b) => a.run.localeCompare(b.run)).map(({ firstBlockAt, ...e }) => e);
  const blocked = list.filter((e) => e.blocks > 0).length;
  return {
    prepared: prepared.size,
    blocked,
    blocks: list.reduce((n, e) => n + e.blocks, 0),
    startedAfterBlock: list.filter((e) => e.startedAfterBlock).length,
    failedAtCap: list.filter((e) => e.failed === 'stall-cap').length,
    cannotStart: list.filter((e) => e.failed === 'cannot-start').length,
    rate: prepared.size ? blocked / prepared.size : 0,
    runs: list
  };
}

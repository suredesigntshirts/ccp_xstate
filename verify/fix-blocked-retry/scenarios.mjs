// The not-blocked routes of quick-fix, plus a block, as plain facts: the state after each step, every card's question,
// choices and input names, and the error text of each error the item took. Run as a script it prints them as JSON:
// `node verify/fix-blocked-retry/scenarios.mjs` in a checkout. evidence/main-scenarios.json is this script's output in
// a checkout of main (see verdict.json for the commit), so the test can compare the PR's head with main in CI, whose
// clone has no main.
import { world, BRIEFS, blocked, builds, verifies, redWake, lastError } from './lib.mjs';

const hex = (s) => JSON.parse(JSON.stringify(s).replace(/\b[0-9a-f]{40}\b/g, '<sha>'));

async function trace(steps) {
  const w = await world();
  const out = { states: [], cards: [], errors: [] };
  const note = () => {
    out.states.push(w.state('a'));
    const err = lastError(w, 'a');
    if (err && JSON.stringify(err) !== JSON.stringify(out.errors.at(-1)?.raw)) out.errors.push({ raw: err, error: err.error });
  };
  try {
    await w.start('a');
    note();
    for (const step of steps) { await step(w); note(); }
    out.cards = w.cards.map((c) => ({ question: c.question, choices: c.choices, inputs: Object.keys(c.inputs ?? {}).sort() }));
    out.errors = out.errors.map((e) => e.error);
    out.final = w.snap('a').context.failure;
    return hex(out);
  } finally {
    await w.close();
  }
}

const brief = (w) => w.agent('a', 'brief', () => BRIEFS);
const build = (opts) => (w) => w.agent('a', 'build', builds(w, opts));
const verify = (r) => (w) => w.agent('a', 'verify', verifies(r));

export const SCENARIOS = {
  // A verify FAIL, then a rebuild and a second FAIL: replanning.
  'verify-fail': () => trace([brief, build(), verify('FAIL'), build(), verify('FAIL')]),
  // A red check on the first build: back to building; a red check on the rebuild: replanning.
  'red-check': () => trace([brief, build({ green: false }), (w) => w.drive('a', redWake(w.gh.prs[1].head)), build({ green: false }), (w) => w.drive('a', redWake(w.gh.prs[1].head))]),
  // A build agent that stops without returning (failed.json).
  'build-stopped': () => trace([brief, (w) => w.stops('a', 'build')]),
  // A brief agent that stops without returning: a briefing error.
  'brief-error': () => trace([(w) => w.stops('a', 'brief')]),
  // A blocked first build: only its error text is compared with main (main replans, the PR asks blocked).
  'blocked-text': () => trace([brief, (w) => w.agent('a', 'build', blocked())])
};

export async function all() {
  const out = {};
  for (const [name, run] of Object.entries(SCENARIOS)) out[name] = await run();
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(JSON.stringify(await all(), null, 1));

// A temp repo shaped like a build PR with a complete verdict from another session, for the local-gate-run and
// world-needs-no-test checks. The toy item has one world line and one verifier line; the verdict's world result
// carries no test field.
import { ITEM, joinItem, read, splitItem, tempRepo } from './lib.mjs';

export const TOY = 'vrg-toy';
export const WORLD_RESULT = { id: 'shown', status: 'MET', command: 'pull_request_read get_check_runs',
  excerpt: 'ci green at verified_sha' };

export function buildWithVerdict(t, { world = WORLD_RESULT } = {}) {
  const r = tempRepo(t);
  const { head, rest } = splitItem(read(`plan/items/${ITEM}.md`));
  const toy = { ...head, id: TOY, status: 'done', depends_on: [],
    expect: [
      { id: 'shown', check: 'The PR\'s checks are green at the head sha', how: 'The checks run on GitHub', proof: 'world' },
      { id: 'tested', check: 'A test passes', how: 'The verifier\'s own test', proof: 'verifier' },
    ] };
  r.commit({ [`plan/items/${TOY}.md`]: joinItem(toy, rest) }, 'base: toy item');
  r.git('update-ref', 'refs/remotes/origin/main', 'HEAD');
  r.git('checkout', '-q', '-b', `build/${TOY}`);
  const built = r.commit({ 'docs/vrg.md': 'one line\n' }, 'build: a line\n\nClaude-Session: s-build');
  const verified = r.commit({
    [`verify/${TOY}/ok.test.mjs`]: "import test from 'node:test';\ntest('holds', () => {});\n",
    [`verify/${TOY}/verdict.json`]: JSON.stringify({ item: TOY, verified_sha: built,
      verifier: { session: 's-verify', model: 'm' },
      results: [world, { id: 'tested', status: 'MET', command: 'node --test', excerpt: '1 pass',
        test: `verify/${TOY}/ok.test.mjs` }] }, null, 2),
  }, 'verify: toy\n\nClaude-Session: s-verify');
  return { ...r, built, verified };
}

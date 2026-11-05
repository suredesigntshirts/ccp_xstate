// Verifier's helpers for plan item fix-refusal-hints. Scenarios run on the real engine (the tourney world: real
// spawn, bind, accept(), drive) from workflows/quick-fix.json, against any checkout's engine: `repo` is the root of
// the checkout whose packages/engine is used, so the same scenario runs at the PR's head and at main.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = join(HERE, '..', '..');

export const ISSUE = {
  url: 'https://github.com/o/r/issues/42',
  title: 'Add clamp',
  body: 'Please add clamp(x, lo, hi) to math.js.',
  expect: ['clamp is exported from math.js', 'clamp throws a RangeError when lo > hi', 'README documents clamp']
};

/** The `## Output` line of a top-level field, read from workflows/quick-fix/<stage>.md as the person wrote it. */
export function outputLine(stage, field, repo = REPO) {
  const md = readFileSync(join(repo, 'workflows', 'quick-fix', `${stage}.md`), 'utf8');
  const part = md.slice(md.indexOf('## Output'));
  const line = part.split('\n').find((l) => l.startsWith(`- ${field}: `));
  assert.ok(line, `${stage}.md ## Output has a ${field} line`);
  return line.slice(`- ${field}: `.length);
}

export async function engineOf(repo = REPO) {
  const world = await import(pathToFileURL(join(repo, 'packages/engine/test/tourney/world.js')).href);
  const actors = await import(pathToFileURL(join(repo, 'packages/engine/src/actors.js')).href);
  return { ...world, A: actors };
}

/** A quick-fix item driven to building (build run open) or verifying (verify run open). */
export async function at(E, w, id, where) {
  await w.start(id, 'quick-fix', { issue: ISSUE });
  assert.ok((await w.agent(id, 'brief', () => E.BRIEFS)).accepted);
  await w.drive(id);
  if (where === 'building') { assert.equal(w.host(id).snapshot.value, 'building'); return; }
  assert.ok((await w.agent(id, 'build', E.builds(w, 1))).accepted);
  await w.drive(id);
  if (w.host(id).snapshot.value !== 'verifying') await w.drive(id, E.suiteWake(w.host(id).snapshot.context.pr.at));
  assert.equal(w.host(id).snapshot.value, 'verifying');
}

/** A verify result built from its input, changed by `bad`. */
export const verifyResult = (w, bad = (r) => r) => async ({ input, worktree }) => {
  w.checkout(worktree, input.target.at);
  return bad({
    result: 'PASS', pr: { url: input.target.url, at: input.target.at }, issue: structuredClone(input.issue),
    lines: input.issue.expect.map((line) => ({ line, result: 'PASS', evidence: `checked: ${line}` }))
  }, input);
};

/** The hint scenarios of the Expect line `hint`: accept()'s full answer for each. */
export async function hintScenarios(repo = REPO) {
  const E = await engineOf(repo);
  const out = {};
  const w = await E.makeWorld();
  try {
    await at(E, w, 'v1', 'verifying');
    out.shortAt = await w.agent('v1', 'verify', verifyResult(w, (r) => ({ ...r, pr: { ...r.pr, at: r.pr.at.slice(0, 7) } })), 'ag-v1');
    out.twoFields = await w.agent('v1', 'verify', verifyResult(w, (r) => { const { lines, ...rest } = r; return { ...rest, pr: { ...r.pr, at: r.pr.at.slice(0, 7) } }; }), 'ag-v1');
    out.covers = await w.agent('v1', 'verify', verifyResult(w, (r) => ({ ...r, lines: r.lines.slice(0, 2) })), 'ag-v1');
    await at(E, w, 'b1', 'building');
    out.buildProse = await w.agent('b1', 'build', async ({ worktree }) => {
      const head = w.commit(worktree, 'build');
      return { pr: { url: 'I opened the pull request on GitHub, see the repo', at: head } };
    }, 'ag-b1');
  } finally { await w.close(); }
  return out;
}

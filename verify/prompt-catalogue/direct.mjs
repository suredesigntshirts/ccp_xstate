// Verifier's direct calls for plan item prompt-catalogue (same-text): accept()'s refusals on the real engine (the
// tourney world, via verify/fix-refusal-hints/lib.mjs, which runs against any checkout) and the text functions of
// actors.js and stages.js, with fixed values, at the checkout `repo`. direct(repo) gives { name: text }, temp paths
// and shas normalised. Run directly with a checkout path to print them (how base-direct.json was made at b5613ba).
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';

export async function direct(repo) {
  const L = await import('../fix-refusal-hints/lib.mjs');
  const A = await import(pathToFileURL(join(repo, 'packages/engine/src/actors.js')).href);
  const S = await import(pathToFileURL(join(repo, 'packages/engine/src/stages.js')).href);
  const out = {};
  const h = await L.hintScenarios(repo);
const norm = (s) => String(s).replaceAll(tmpdir(), '/tmp').replace(/\/tmp\/[^\s"',)]+/g, '<TMP>').replace(/\b[0-9a-f]{40}\b/g, '<SHA>').replace(/\b[0-9a-f]{7}\b/g, '<SHORT>');
  for (const [k, v] of Object.entries(h)) out[`hint-${k}`] = norm(v.refused ? A.refusalText(v) : JSON.stringify(v));
  const refused = { rule: 'schema', reason: 'build result: result.pr is missing <&>' };
  out.r0 = A.refusalText({ refused });
  out.r1 = A.refusalText({ refused, fix: { count: 3, cap: 10, hint: [] } });
  out.r2 = A.refusalText({ refused, fix: { count: 3, cap: 10, hint: ['pr: The PR <url> & sha', 'x: y: z'] } });
  out.r3 = A.refusalText({ refused, fix: { count: 10, cap: 10, hint: ['pr: a'] }, failed: 'i:1.build' });
  out.r4 = A.refusalText({ refused, fix: { count: 10, cap: 10, hint: [] }, failed: 'i:1.build' });
  out.r5 = A.refusalText({ refused, failed: 'i:1.build' });
  out.d1 = A.differences({ a: 1, b: { c: 2 } }, { a: 2, b: {} }, 'result.issue', 'issue');
  out.st = A.stallText({ item: 'i', state: '"building"', run: 'i:1.build', actor: 'build' }, 1);
  out.st2 = A.stallText({ item: 'i', state: 'not json', run: 'i:1.build', actor: 'build' }, 2);
  out.cf = [A.confine({ worktree: '/w', tool: 'Write', input: { file_path: '/x/y' } }), A.confine({ worktree: '/w', tool: 'Grep', input: { pattern: 'a', path: '/etc' } }), A.confine({ worktree: '/w', tool: 'Bash', input: { command: 'ls' } })];
  out.unc = [S.uncovered({ properties: { lines: { covers: 'issue.expect' } } }, { issue: { expect: 'x' } }, {}),
  S.uncovered({ properties: { lines: { covers: 'issue.expect' } } }, { issue: { expect: ['a', 'b'] } }, { lines: [{ line: 'a' }] }),
  S.uncovered({ properties: { lines: { covers: 'issue.expect' } } }, { issue: { expect: ['a'] } }, { lines: [{ line: 'a' }, { line: 'c' }] }),
  S.uncovered({ properties: { lines: { covers: 'issue.expect' } } }, { issue: { expect: ['a', 'b'] } }, { lines: [{ line: 'b' }, { line: 'a' }] }),
  S.uncovered({ properties: { lines: { covers: 'issue.expect' } } }, { issue: { expect: ['a'] } }, { result: 'FAIL', lines: [{ line: 'a', result: 'PASS' }] })];
  out.run = S.runLine({ run: 'i:1.b', worktree: '/w', repo: '/r', github: 'o/r', branch: 'run/i/1.b' }) + '|' + S.runLine({ run: 'i:1.b', worktree: '/w', repo: '/r', github: null, branch: 'b' }) + '|' + S.returnLine('i:1.b') + '|' + S.returnLine(undefined);
  if (A.waitingText) out.wt = A.waitingText([{ actor: 'brief', run: 'i:0.brief', prompt: 'ccp-run i:0.brief' }]);
  if (A.boundText) out.bt = A.boundText('Run x.');
return out;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await direct(process.argv[2]), null, 1));

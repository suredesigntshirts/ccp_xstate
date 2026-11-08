// Expect local-gate-run: the command docs/gates.md gives for a local verdict run, with <id> filled in, run as written
// by a shell at the head of a temp build branch holding a complete verdict from another session, passes; with PR_BODY
// unset it refuses for naming no item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read, run } from './lib.mjs';
import { TOY, buildWithVerdict } from './gate-fixture.mjs';

const gates = read('docs/gates.md');
const commands = [...gates.matchAll(/`([^`]*pr-gate\.mjs verdict[^`]*)`/g)].map((m) => m[1]);

test('docs/gates.md gives one local verdict-gate command, with BASE_SHA and PR_BODY carrying the Item line', (t) => {
  t.diagnostic(commands.join(' | '));
  assert.equal(commands.length, 1);
  assert.match(commands[0], /\bBASE_SHA=origin\/main\b/);
  assert.match(commands[0], /\bPR_BODY='Item: <id>'/);
  assert.match(gates, /at\s+the checkout's HEAD with `BASE_SHA/);
});

test('the command as written passes a build branch with a complete verdict, and refuses with PR_BODY unset', (t) => {
  const r = buildWithVerdict(t);
  const cmd = commands[0].replaceAll('<id>', TOY);
  const ok = run('sh', ['-c', cmd], { cwd: r.dir });
  t.diagnostic(`${cmd}\n${ok.out.trim()}`);
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.out, new RegExp(`verdict gate passed \\(item ${TOY}\\)`));

  const unset = run('sh', ['-c', cmd.replace(/PR_BODY='[^']*'\s*/, '')], { cwd: r.dir });
  t.diagnostic(unset.out.trim());
  assert.equal(unset.status, 1, unset.out);
  assert.match(unset.out, /names no item/);
});

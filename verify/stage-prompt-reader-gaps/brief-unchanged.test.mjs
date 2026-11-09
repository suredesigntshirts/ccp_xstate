// Expect brief-unchanged: the brief stage renders the same prompt at the base and the head. The base's prompt for case
// real-jsonl-lint was rendered at the PR's base (main 57c9212e, `--rev`) into evidence/brief-base-prompt.md; this test
// renders the head's and compares them byte for byte, and renders the base live too when BASE_SHA or origin/main is
// reachable (not in ci.yml's depth-1 checkout).
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVIDENCE, REPO, render } from './lib.mjs';

const head = render('brief', ['--case', 'real-jsonl-lint']).prompt;

test('the head renders the brief prompt recorded at the base', (t) => {
  const base = readFileSync(join(EVIDENCE, 'brief-base-prompt.md'), 'utf8');
  t.diagnostic(`${head.length} chars at the head, ${base.length} recorded at the base`);
  assert.equal(head, base);
});

test('the base, rendered live where git reaches it, gives the same prompt', (t) => {
  const reach = [process.env.BASE_SHA, 'origin/main'].filter(Boolean).find((r) => {
    try { execFileSync('git', ['-C', REPO, 'rev-parse', '--verify', '--quiet', `${r}^{commit}`], { stdio: 'ignore' }); return true; } catch { return false; }
  });
  if (!reach) { t.diagnostic('no base reachable: the recorded render stands'); return; }
  const base = render('brief', ['--case', 'real-jsonl-lint', '--rev', reach]).prompt;
  t.diagnostic(`base ${reach}`);
  assert.equal(head, base);
});

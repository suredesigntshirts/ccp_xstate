// Expect build-verify-answers: the build prompt, rendered from a recorded input, returns at once even where task says
// to wait for CI, says a red check comes back as failure, and names none of key, gates, green or checkout as things to
// set; the verify prompts of quick-fix and research call the stricter source task, not the brief; quick-fix's verify
// undoes changes to tracked files; both describe the issue output as { url, expect } with no list of keys to leave out.
// Rules are read by the words that carry them (docs/layout.md, Tests), never as whole sentences.
import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { EVIDENCE, flat, harnessWords, outputLine, part, render } from './lib.mjs';

const build = render('build', ['--input', join(EVIDENCE, 'build-input.json')]).prompt;
const verify = render('verify', ['--input', join(EVIDENCE, 'verify-input.json')]).prompt;
const research = render('verify', ['--workflow', 'workflows/research.json', '--input', join(EVIDENCE, 'verify-input.json')]).prompt;
const rules = (p) => part(p, 'Rules').split('\n').filter((l) => l.startsWith('- ')).map(flat);

test('build returns at once even where task says to wait for CI, and a red check comes back as failure', (t) => {
  const r = rules(build).find((l) => /\breturn\b/i.test(l) && /wait for CI/.test(l));
  t.diagnostic(r ?? 'no return rule names waiting for CI');
  assert.ok(r, 'a rule on returning names waiting for CI');
  assert.match(r, /\beven where task\b/, 'the rule holds even where task says to wait');
  assert.match(r, /\bas soon as\b|\bat once\b/, 'return at once');
  assert.match(r, /\bred check\b/);
  assert.match(r, /\bfailure\b/, 'a red check comes back as failure');
});

test('build pushes its last commit before returning and nothing after', (t) => {
  const r = rules(build).find((l) => /\bpush/i.test(l) && /\breturn/.test(l) && /verified/.test(l));
  t.diagnostic(r ?? 'none');
  assert.ok(r);
  assert.match(r, /\blast commit\b/);
  assert.match(r, /\bnothing after\b/);
  assert.doesNotMatch(r, /do not push again/);
});

test('build no longer names key, gates, green or checkout as pr fields', (t) => {
  const words = harnessWords(build);
  for (const w of ['gates', 'green', 'checkout']) assert.doesNotMatch(words, new RegExp(`\\b${w}\\b`), w);
  assert.doesNotMatch(words, /\bkey, gates\b/);
  const pr = flat(outputLine(build, 'pr'));
  t.diagnostic(pr);
  assert.match(pr, /\bno other key in pr\b/);
});

for (const [name, p] of [['quick-fix', verify], ['research', research]]) {
  test(`${name} verify calls the stricter source task, not the brief`, (t) => {
    const r = rules(p).find((l) => /^- Grade only issue\.expect/.test(l));
    t.diagnostic(r ?? 'none');
    assert.ok(r);
    assert.match(r, /\bin task stricter\b/);
    assert.doesNotMatch(harnessWords(p), /\bthe brief\b/);
  });

  test(`${name} verify describes the issue output as { url, expect } with no keys to leave out`, (t) => {
    const l = flat(outputLine(p, 'issue'));
    t.diagnostic(l);
    assert.match(l, /\{ url, expect \}/);
    assert.match(l, /\bcopied exactly\b/);
    assert.doesNotMatch(l, /leave out|title, body|any other key you add/);
    assert.match(l, /\bno other key\b/);
  });
}

test('quick-fix verify undoes changes to tracked files', (t) => {
  const r = rules(verify).find((l) => /\bundo\b/.test(l));
  t.diagnostic(r ?? 'none');
  assert.ok(r);
  assert.match(r, /\btracked files\b/);
  assert.doesNotMatch(r, /undo any local change/);
});

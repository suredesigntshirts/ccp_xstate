// The return-answers steps against the plugin scripts at `scripts`.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { briefBound, textOf } from './lib.mjs';

export async function scenario(t, scripts) {
  const p = await briefBound(scripts);
  const sent = { builder: 'Add clamp to math.js and open a PR.', verifier: 'Check clamp.' };
  const hookAnswer = await p.send(sent);
  const stored = JSON.parse(readFileSync(join(p.root, 'items', 'it-1', 'runs', '0.brief', 'result.json'), 'utf8'));
  assert.equal(typeof stored.sent, 'string', 'accept stored the sent hash');
  const reordered = { verifier: sent.verifier, builder: sent.builder };
  assert.notEqual(JSON.stringify(reordered), JSON.stringify(sent));
  const yes = textOf(await p.ask(reordered));
  const no = textOf(await p.ask({ builder: sent.builder, verifier: 'Check clamp twice.' }));
  const extra = textOf(await p.ask({ ...reordered, notes: 'x' }));
  t.diagnostic(`hook: ${JSON.stringify(hookAnswer)}; stored sent ${stored.sent.slice(0, 12)}`);
  t.diagnostic(`reordered: ${yes}`);
  t.diagnostic(`changed: ${no}`);
  t.diagnostic(`extra key: ${extra}`);
  assert.match(yes, /^accepted: /, 'the same result, keys reordered, is answered as returned');
  assert.doesNotMatch(no, /^accepted/, 'a changed value is not');
  assert.doesNotMatch(extra, /^accepted/, 'an added key is not');
  return { p, stored };
}

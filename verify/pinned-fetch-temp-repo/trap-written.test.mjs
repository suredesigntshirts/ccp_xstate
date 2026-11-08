// trap-written: docs/traps.md's shallow-clone entry says a test that needs a pinned commit fetches it into a temp
// repo, not the checkout, and names .git/shallow.lock.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

test('the shallow-clone entry tells a test to fetch pinned commits into a temp repo', () => {
  const text = readFileSync(join(REPO, 'docs/traps.md'), 'utf8');
  const entry = text.match(/^## Clones can be shallow\n[\s\S]*?(?=^## |(?![\s\S]))/m)?.[0];
  assert.ok(entry, 'the entry exists');
  const flat = entry.replace(/\s+/g, ' ');
  assert.match(flat, /pinned commit/i);
  assert.match(flat, /temp (bare )?repo/i);
  assert.match(flat, /never into the checkout|not (into )?the checkout/i);
  assert.match(flat, /\.git\/shallow\.lock/);
});

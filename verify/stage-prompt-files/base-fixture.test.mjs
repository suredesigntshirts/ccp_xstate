// The committed base-workflows/*.json are the base commit's workflows/*.json byte for byte, and they are the whole
// of the base's workflows/ (no stage files then). Skipped in a shallow clone without the base commit (CI); a full
// clone checks it.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { BASE, BASE_FIXTURES, REPO, hasBase } from './lib.mjs';

test('base-workflows/ equals the base commit\'s workflows/', { skip: hasBase() ? false : 'shallow clone: the base commit is not here' }, () => {
  const listed = execFileSync('git', ['-C', REPO, 'ls-tree', '--name-only', `${BASE}:workflows`], { encoding: 'utf8' }).trim().split('\n').sort();
  assert.deepEqual(readdirSync(BASE_FIXTURES).sort(), listed);
  for (const f of listed) assert.ok(execFileSync('git', ['-C', REPO, 'show', `${BASE}:workflows/${f}`]).equals(readFileSync(join(BASE_FIXTURES, f))), f);
});

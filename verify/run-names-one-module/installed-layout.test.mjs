// Expect installed-layout: with the plugin laid out as setup.sh installs it (lib/engine/src beside scripts/), the return
// tool and the actor hooks load names.js from lib/engine/src and answer as in return-answers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { installed, textOf } from './lib.mjs';
import { scenario } from './scenario.mjs';

test('installed-layout: the installed copy answers as the repo does, from lib/engine/src/names.js', async (t) => {
  const inst = installed();
  assert.ok(existsSync(join(inst.out, 'lib', 'engine', 'src', 'names.js')), 'setup.sh layout bundles names.js');
  assert.ok(!existsSync(join(inst.out, '..', '..', 'packages', 'engine', 'src')), 'no repo engine beside the copy');
  const { p } = await scenario(t, inst.scripts);
  // Control: without lib/engine/src/names.js (and CCP_REPO pointing nowhere) the same server cannot answer, so the
  // answers above came from the bundled names.js.
  const at = join(inst.out, 'lib', 'engine', 'src', 'names.js');
  renameSync(at, `${at}.gone`);
  const res = await p.ask({ verifier: 'Check clamp.', builder: 'Add clamp to math.js and open a PR.' });
  t.diagnostic(`without names.js: ${JSON.stringify(res).slice(0, 300)}`);
  assert.doesNotMatch(textOf(res), /^accepted/);
  assert.ok(res.exit !== undefined && res.exit !== 0, 'the server exits instead of answering');
  assert.match(res.stderr, /no engine library/);
  renameSync(`${at}.gone`, at);
});

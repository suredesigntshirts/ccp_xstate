// Expect return-answers: through the real return-tool server and the real PreToolUse hook (plugins/harness/scripts in
// this checkout), a result sent with its keys in another order from the one accept stored is answered as returned,
// and a different result is not.
import { test } from 'node:test';
import { join } from 'node:path';
import { REPO } from './lib.mjs';
import { scenario } from './scenario.mjs';

test('return-answers: repo layout, keys reordered answered, different result not', async (t) => {
  await scenario(t, join(REPO, 'plugins', 'harness', 'scripts'));
});

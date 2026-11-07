// readme-complete: packages/engine/README.md names every export of src/index.js and every command bin/host.js
// accepts, and holds no history reference (the Expect line's own pattern).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const REPO = fileURLToPath(new URL('../../', import.meta.url));
const read = (p) => readFileSync(REPO + p, 'utf8');
const readme = read('packages/engine/README.md');
const HISTORY = /plan item|\((fix|engine|obs|wf|inspector|stage|prompt|probe|journal|refine)-[a-z-]+[),]|[Dd]esign [A-E],|lane [A-E]|graft|round[- ][12]|before (fix|stage|prompt)-/;

function exportsOf(src) {
  const names = new Set();
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm))
    for (const part of m[1].split(',')) { const n = part.trim().split(/\s+as\s+/).pop().trim(); if (n) names.add(n); }
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:const|let|function\*?|class)\s+([A-Za-z_$][\w$]*)/gm)) names.add(m[1]);
  return [...names];
}
function commandsOf(src) {
  const m = src.match(/if \(!\[([^\]]*)\]\.includes\(command\)\)/);
  assert.ok(m, 'host.js has its list of accepted commands');
  return [...m[1].matchAll(/'([a-z-]+)'/g)].map((x) => x[1]);
}

test('the engine exports and host commands are read from the source', () => {
  const ex = exportsOf(read('packages/engine/src/index.js'));
  assert.ok(ex.length >= 30, `found ${ex.length} exports`);
  assert.ok(ex.includes('loadWorkflow') && ex.includes('workflowOf') && ex.includes('OwnedError'));
  assert.deepEqual(commandsOf(read('packages/engine/bin/host.js')), ['start', 'wake', 'show', 'card', 'closed', 'answer']);
});
test('the README names every export of src/index.js', () => {
  const missing = exportsOf(read('packages/engine/src/index.js')).filter((n) => !new RegExp(`\\b${n.replace('$', '\\$')}\\b`).test(readme));
  assert.deepEqual(missing, []);
});
test('the README names every bin/host.js command as a command', () => {
  const missing = commandsOf(read('packages/engine/bin/host.js')).filter((c) => !new RegExp(`host\\.js ${c}\\b|\`${c}\``).test(readme));
  assert.deepEqual(missing, []);
});
test('the README holds no history reference', () => {
  const hits = readme.split('\n').map((l, i) => [i + 1, l]).filter(([, l]) => HISTORY.test(l));
  assert.deepEqual(hits, []);
});

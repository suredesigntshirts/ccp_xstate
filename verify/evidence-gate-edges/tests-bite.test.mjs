// Expect tests-bite: scripts/gates/test/lib.test.mjs goes red when checkEvidence stops refusing a symlink mode, and
// again when isListing always answers false; scripts/gates/test/pr-gate.test.mjs goes red when the evidence gate stops
// passing the mode from git ls-tree; each is green again when restored. Mutations happen in a temp copy of scripts/.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, node, tempDir } from './lib.mjs';

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'lib.test.mjs goes red when checkEvidence stops refusing a symlink mode',
    file: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: /if \(!REGULAR\.has\(mode\)\)/, to: 'if (false)' },
  { name: 'lib.test.mjs goes red when isListing always answers false',
    file: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: /return has\('pass'\) && has\('fail'\) && results >= LISTING_LINES;/, to: 'return false;' },
  { name: 'pr-gate.test.mjs goes red when the evidence gate stops passing the mode from git ls-tree',
    file: 'scripts/gates/pr-gate.mjs', test: 'scripts/gates/test/pr-gate.test.mjs',
    from: /const mode = git\('ls-tree', head, '--', path\)\.split\(\/\\s\/\)\[0\];/, to: 'const mode = undefined;' },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = tempDir(t, 'ege-bite-');
    for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
    const run = () => node(['--test', '--test-reporter=tap', join(dir, b.test)], { cwd: dir });
    const green = run();
    assert.equal(green.status, 0, green.out);
    const p = join(dir, b.file);
    const text = readFileSync(p, 'utf8');
    assert.match(text, b.from, `the rule to break is in ${b.file}`);
    writeFileSync(p, text.replace(b.from, b.to));
    const red = run();
    assert.notEqual(red.status, 0, red.out);
    assert.ok(counts(red.out).fail > 0, red.out);
    writeFileSync(p, text);
    const again = run();
    assert.equal(again.status, 0, again.out);
    t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  });
}

// Expect tests-bite: scripts/gates/test/lib.test.mjs goes red when checkEvidence stops refusing a file over the
// limit, and again when it stops refusing a .pass file; green when restored. Mutations happen in a temp copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node } from './lib.mjs';

const TEST = 'scripts/gates/test/lib.test.mjs';
const CODE = 'scripts/gates/lib.mjs';
const run = (dir) => node(['--test', '--test-reporter=tap', join(dir, TEST)], { cwd: dir });
const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'lib.test.mjs goes red when checkEvidence stops refusing files over the limit',
    from: /if \(size > EVIDENCE_LIMIT\)/, to: 'if (false)' },
  { name: 'lib.test.mjs goes red when checkEvidence stops refusing .pass files',
    from: /if \(path\.endsWith\('\.pass'\)\)/, to: 'if (false)' },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'vep-bite-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
    const green = run(dir);
    assert.equal(green.status, 0, green.out);
    const p = join(dir, CODE);
    const text = readFileSync(p, 'utf8');
    assert.match(text, b.from, 'the rule to break is in checkEvidence');
    writeFileSync(p, text.replace(b.from, b.to));
    const red = run(dir);
    assert.notEqual(red.status, 0, red.out);
    assert.ok(counts(red.out).fail > 0, red.out);
    writeFileSync(p, text);
    const again = run(dir);
    assert.equal(again.status, 0, again.out);
    t.diagnostic(`green ${JSON.stringify(counts(green.out))}, broken ${JSON.stringify(counts(red.out))}, restored ${JSON.stringify(counts(again.out))}`);
  });
}

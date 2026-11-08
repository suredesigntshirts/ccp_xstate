// Expect tests-bite: scripts/gates/test/lib.test.mjs goes red when contractMoves stops reporting a changed Verifier
// brief, and again when checkDoneOn stops refusing a moved date; scripts/gates/test/pr-gate.test.mjs goes red when
// the verdict gate stops reading the item at verified_sha; green when restored. Mutations happen in a temp copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { REPO, node } from './lib.mjs';

const counts = (out) => ({ pass: Number(out.match(/^# pass (\d+)/m)?.[1]), fail: Number(out.match(/^# fail (\d+)/m)?.[1]) });

const BITES = [
  { name: 'lib.test.mjs goes red when contractMoves stops reporting a changed Verifier brief',
    code: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: "return a.brief === b.brief ? moved : [...moved, 'Verifier brief'];", to: 'return moved;' },
  { name: 'lib.test.mjs goes red when checkDoneOn stops refusing a moved date',
    code: 'scripts/gates/lib.mjs', test: 'scripts/gates/test/lib.test.mjs',
    from: 'if (was === undefined || was === now) continue;', to: 'continue;' },
  { name: 'pr-gate.test.mjs goes red when the verdict gate stops reading the item at verified_sha',
    code: 'scripts/gates/pr-gate.mjs', test: 'scripts/gates/test/pr-gate.test.mjs',
    from: 'before: show(verified, itemFile)', to: 'before: show(head, itemFile)' },
];

for (const b of BITES) {
  test(b.name, (t) => {
    const dir = mkdtempSync(join(tmpdir(), 'vcv-bite-'));
    t.after(() => rmSync(dir, { recursive: true, force: true }));
    for (const p of ['scripts', 'package.json']) cpSync(join(REPO, p), join(dir, p), { recursive: true });
    const run = () => node(['--test', '--test-reporter=tap', join(dir, b.test)], { cwd: dir });
    const green = run();
    assert.equal(green.status, 0, green.out);
    const p = join(dir, b.code);
    const text = readFileSync(p, 'utf8');
    assert.ok(text.includes(b.from), `the rule to break is in ${b.code}`);
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

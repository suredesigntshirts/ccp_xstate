// tests-bite: each no-self-edit test goes red when the code it guards writes where it says nothing is written. Each
// case breaks one path in a clone of the head, commits it (the tests clone the repo they sit in), runs the tests that
// guard it, and reads which failed and why. The unbroken head passes them (runs-without-strace.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_SELF_EDIT, cloneHead, commitAll, failing, nodeTest, temp } from './lib.mjs';

const SETUP = 'infra/cloud-environment/setup.sh';
const HOOK = 'plugins/harness/scripts/notice-behind.mjs';
const RELEASE = 'scripts/release/release.mjs';
const NOT_REPLACED = /^(\s*)echo "plugin not replaced: .*"$/m;

/** After the shebang, a line that writes `target` when the script loads. */
const writeOnLoad = (src, target) => src.replace(/^(#!.*\n)/, `$1import { writeFileSync as secsWrite } from 'node:fs'; secsWrite(${target}, 'x');\n`);

const CASES = [
  {
    name: 'setup.sh says it left the plugin alone but replaces it beside a live Claude',
    file: SETUP,
    edit: (s) => s.replace(NOT_REPLACED, (line, ind) => `${line}\n${ind}rm -rf "$dest.old"; mv "$dest" "$dest.old"; mv "$work/out" "$dest"; rm -rf "$dest.old"`),
    pattern: 'live Claude',
    red: ['same HOME writes nothing', 'newest release only a branch'],
    why: /nothing under the plugin root or its \.old changed|deepStrictEqual/,
  },
  {
    name: 'setup.sh only touches plugin.json beside a live Claude (same bytes, new mtime)',
    file: SETUP,
    edit: (s) => s.replace(NOT_REPLACED, (line, ind) => `${line}\n${ind}touch "$dest/.claude-plugin/plugin.json"`),
    pattern: 'live Claude',
    red: ['same HOME writes nothing', 'newest release only a branch'],
    why: /plugin\.json/,
  },
  {
    name: 'the notice hook writes a file beside itself under the plugin root',
    file: HOOK,
    edit: (s) => writeOnLoad(s, `new URL('./written.txt', import.meta.url)`),
    pattern: 'notice hook',
    red: ['notice hook'],
    why: /written\.txt/,
  },
  {
    name: 'release.mjs writes a file at the repo root',
    file: RELEASE,
    edit: (s) => writeOnLoad(s, `process.cwd() + '/written.txt'`),
    pattern: 'release\\.mjs',
    red: ['only writes git objects', 'branch --push writes only git refs'],
    why: /written\.txt/,
  },
];

for (const c of CASES) {
  test(`tests-bite: ${c.name}`, (t) => {
    const repo = cloneHead(temp(t, 'bite'));
    const p = join(repo, c.file), src = readFileSync(p, 'utf8'), broken = c.edit(src);
    assert.notEqual(broken, src, 'the break applied');
    writeFileSync(p, broken);
    commitAll(repo, 'break');
    const r = nodeTest(repo, NO_SELF_EDIT, { args: [`--test-name-pattern=${c.pattern}`] });
    const red = failing(r.out);
    t.diagnostic(`red: ${JSON.stringify(red)}`);
    t.diagnostic(`why: ${(r.out.match(c.why) ?? [''])[0]}`);
    for (const name of c.red) assert.ok(red.some((n) => n.includes(name)), `${name} went red: ${red}`);
    assert.match(r.out, c.why, 'the failure names the changed entry');
  });
}

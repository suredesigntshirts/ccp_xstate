#!/usr/bin/env node
// A PR's guards: npm test's two passes over only the guard files select-tests.mjs picks for the PR's change, or npm
// test itself when it picks all. The change is HEAD^1..HEAD: on a pull_request run, actions/checkout checks out the
// merge of the PR into its base, whose first parent is the base.
//
//   node scripts/ci/pr-tests.mjs [--base <rev>] [--head <rev>]
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO, changedFiles, select } from './select-tests.mjs';

const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
const script = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8')).scripts.test;
const sh = (cmd) => spawnSync('bash', ['-c', cmd], { cwd: REPO, stdio: 'inherit' }).status ?? 1;

const changed = changedFiles(arg('base', 'HEAD^1'), arg('head', 'HEAD'));
const picked = select(changed);
console.log(`changed: ${changed.length} file(s)`);
if (picked.all) {
  console.log(`running every guard: ${picked.why}`);
  process.exit(sh(script));
}
console.log(`running ${picked.files.length} guard file(s):`);
for (const { file, why } of picked.files) console.log(`  ${file}  (reaches ${why})`);
const files = new Set(picked.files.map((f) => f.file));
const quote = (f) => `'${f.replace(/'/g, `'\\''`)}'`;
// Each pass keeps its flags and runs the picked files among the ones its globs or names cover.
const passes = script.split(' && ').map((cmd) => {
  const words = cmd.match(/(?:[^\s"]|"[^"]*")+/g);
  const flags = words.filter((w) => w === 'node' || w.startsWith('--'));
  const named = words.filter((w) => !(w === 'node' || w.startsWith('--'))).map((w) => w.replace(/^"|"$/g, ''));
  const globbed = named.some((n) => n.includes('*'));
  const mine = [...files].filter((f) => (globbed ? true : named.includes(f)));
  return mine.length ? `${flags.join(' ')} ${mine.map(quote).join(' ')}` : null;
});
let status = 0;
for (const p of passes) if (p && (status = sh(p)) !== 0) break;
process.exit(status);

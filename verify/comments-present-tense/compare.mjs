// code-unchanged: every .js/.mjs file the PR changes outside scripts/gates/, comments stripped, is identical at the
// base and the head. Usage: node compare.mjs <base-sha> <head-sha> (run inside a clone holding both).
import { execFileSync } from 'node:child_process';
import { strip } from './strip.mjs';
const [base, head] = process.argv.slice(2);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const files = git('diff', '--name-only', `${base}...${head}`).split('\n')
  .filter((f) => /\.(m?js)$/.test(f) && !f.startsWith('scripts/gates/') && !f.startsWith('verify/'));
let bad = 0;
for (const f of files) {
  const a = strip(git('show', `${base}:${f}`));
  const b = strip(git('show', `${head}:${f}`));
  const same = a === b;
  if (!same) bad++;
  console.log(`${same ? 'IDENTICAL' : 'DIFFERS  '} ${f} (${a.length} bytes stripped)`);
}
console.log(`${files.length} files, ${bad} differ`);
process.exit(bad ? 1 : 0);

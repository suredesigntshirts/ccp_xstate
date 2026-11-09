// The verifier's measurements for same-tests and faster, too slow for npm test: run in two clean clones, one at the
// PR's base and one at the verified head, each with npm ci done, release tags and branches deleted and origin on
// GitHub (as ci's checkout has it). Nothing else runs on the machine meanwhile.
//   node verify/fast-test-clones-and-setup/record.mjs <base clone> <head clone> <out.json> [rounds]
// faster: the three files run alone, one after another, base then head, `rounds` times (default 3); a file's time is
// its run's `# duration_ms`. same-tests: the TAP names and ok/not ok of every test in the changed files, from the
// first round for the three timed files and from one run each for the others.
import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const [baseDir, headDir, out, roundsArg] = process.argv.slice(2);
const rounds = Number(roundsArg ?? 3);
const TIMED = ['test/regression/plugin/no-self-edit.test.mjs', 'test/regression/plugin/self-edit-check.test.mjs', 'test/setup.test.mjs'];
const OTHERS = ['scripts/clean-room/test/run.test.mjs', 'test/regression/plugin/release-clone-and-keep.test.mjs', 'test/regression/plugin/setup-install.test.mjs', 'test/setup-release.test.mjs'];
const { NODE_TEST_CONTEXT, ...env } = process.env;

function runFile(cwd, file) {
  const t0 = Date.now();
  const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', file], { cwd, env, encoding: 'utf8', maxBuffer: 1e9 });
  const wall = Date.now() - t0;
  const results = [...r.stdout.matchAll(/^(ok|not ok) \d+ - (.*?)(?: # (SKIP|TODO).*)?$/gm)].map((m) => ({ name: m[2], ok: m[1] === 'ok', mark: m[3] ?? null }));
  const ms = Number(r.stdout.match(/^# duration_ms ([\d.]+)/m)?.[1] ?? NaN);
  return { file, status: r.status, ms, wall, results, pass: Number(r.stdout.match(/^# pass (\d+)/m)?.[1]), fail: Number(r.stdout.match(/^# fail (\d+)/m)?.[1]), skipped: Number(r.stdout.match(/^# skipped (\d+)/m)?.[1]) };
}

const log = { base: baseDir, head: headDir, rounds: [], others: {} };
for (let i = 0; i < rounds; i++) {
  for (const side of ['base', 'head']) {
    const cwd = side === 'base' ? baseDir : headDir;
    const files = TIMED.map((f) => runFile(cwd, f));
    log.rounds.push({ round: i + 1, side, sum_ms: files.reduce((n, f) => n + f.ms, 0), files });
    console.log(`round ${i + 1} ${side}: ${files.map((f) => `${f.file} ${Math.round(f.ms)} ms (${f.pass}/${f.fail}/${f.skipped})`).join(', ')}`);
    writeFileSync(out, JSON.stringify(log, null, 1));
  }
}
for (const side of ['base', 'head']) {
  log.others[side] = OTHERS.map((f) => runFile(side === 'base' ? baseDir : headDir, f));
  console.log(`others ${side}: ${log.others[side].map((f) => `${f.file} ${f.pass}/${f.fail}/${f.skipped}`).join(', ')}`);
}
writeFileSync(out, JSON.stringify(log, null, 1));

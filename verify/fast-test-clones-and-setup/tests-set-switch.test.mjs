// tests-set-switch: every setup.sh run a test makes under test/, scripts/, packages/ or plugins/ has
// CCP_SETUP_SKILLS=0 in its environment, except runs in tests that assert the skill's npm install.
// The files run are the tests whose own text, or a local module they import, names setup.sh. A stub bash first on PATH
// records the environment of each run whose script is setup.sh, then runs the real bash; BASH_ENV records runs that
// call /bin/bash by path. self-edit-check.test.mjs is left out: its setup.sh runs happen inside nested runs of
// no-self-edit.test.mjs and test/setup.test.mjs, which run here directly, and it takes minutes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { dirname, join, normalize } from 'node:path';
import { REPO, codeFiles, isTest, read, stub, temp } from './lib.mjs';

const NAMES_SETUP = /cloud-environment|setup\.sh/;
const LEFT_OUT = ['test/regression/plugin/self-edit-check.test.mjs'];

/** Local modules a file imports, repo-relative. */
const imports = (p) => [...read(p).matchAll(/(?:from|import\()\s*['"](\.{1,2}\/[^'"]+)['"]/g)]
  .map((m) => normalize(join(dirname(p), m[1]))).filter((q) => existsSync(join(REPO, q)) && /\.(mjs|js)$/.test(q));

function namesSetup(p, seen = new Set()) {
  if (seen.has(p)) return false;
  seen.add(p);
  return NAMES_SETUP.test(read(p)) || imports(p).some((q) => namesSetup(q, seen));
}

/** A test asserts the skill's npm install when it reads the installed skill's node_modules. */
const assertsSkillInstall = (p) => /documentation-downloader/.test(read(p)) && /node_modules/.test(read(p)) && /skills/.test(read(p)) && /npm ci/.test(read(p));

/** Runs `f` with its own stub bash and BASH_ENV, which record each setup.sh run's environment into its own folder. */
function runRecorded(d, f, i) {
  const own = join(d, String(i));
  mkdirSync(join(own, 'seen'), { recursive: true });
  const seen = join(own, 'seen', 'run');
  stub(join(own, 'bin'), 'bash', `for a in "$@"; do case "$a" in *cloud-environment/setup.sh) env -0 > "${seen}-$$-$RANDOM"; export VFTC_SEEN=$$;; esac; done
exec /bin/bash "$@"
`);
  writeFileSync(join(own, 'bashenv.sh'), `case "$0" in *cloud-environment/setup.sh) if [ "$VFTC_SEEN" != "$$" ]; then env -0 > "${seen}-$$-$RANDOM"; fi;; esac\n`);
  // NODE_TEST_CONTEXT would make the child report to this runner instead of running its tests.
  const { NODE_TEST_CONTEXT, ...base } = process.env;
  const env = { ...base, PATH: `${join(own, 'bin')}:${process.env.PATH}`, BASH_ENV: join(own, 'bashenv.sh') };
  return new Promise((done) => {
    const c = spawn(process.execPath, ['--test', '--test-reporter=tap', f], { cwd: REPO, env, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    c.stdout.on('data', (b) => { out += b; });
    c.on('close', (status) => {
      const runs = readdirSync(join(own, 'seen')).map((n) => Object.fromEntries(readFileSync(join(own, 'seen', n), 'utf8').split('\0').filter(Boolean)
        .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])));
      done({ f, status, pass: Number(out.match(/^# pass (\d+)/m)?.[1] ?? 0), fail: Number(out.match(/^# fail (\d+)/m)?.[1] ?? 0), runs });
    });
  });
}

test('tests-set-switch: every setup.sh run the tests make carries CCP_SETUP_SKILLS=0', async (t) => {
  const files = codeFiles().filter(isTest).filter((p) => !LEFT_OUT.includes(p) && namesSetup(p));
  const d = temp('bash');
  const results = [];
  const queue = files.map((f, i) => [f, i]);
  await Promise.all(Array.from({ length: Math.max(1, Math.min(4, availableParallelism())) }, async () => {
    while (queue.length) { const [f, i] = queue.shift(); results.push(await runRecorded(d, f, i)); }
  }));
  results.sort((a, b) => a.f.localeCompare(b.f));
  for (const r of results) t.diagnostic(`${r.f}: exit ${r.status}, pass ${r.pass}, fail ${r.fail}, setup.sh runs ${r.runs.length}, without the switch ${r.runs.filter((v) => v.CCP_SETUP_SKILLS !== '0').length}`);
  const total = results.reduce((n, r) => n + r.runs.length, 0);
  assert.ok(total >= 10, `setup.sh ran under the stub (${total} runs)`);
  assert.ok(results.every((r) => r.pass > 0), 'every file ran tests');
  const offenders = results.filter((r) => !assertsSkillInstall(r.f)).flatMap((r) => {
    const without = r.runs.filter((v) => v.CCP_SETUP_SKILLS !== '0').length;
    return without ? [`${r.f}: ${without} of ${r.runs.length} runs`] : [];
  });
  assert.deepEqual(offenders, [], 'setup.sh runs without CCP_SETUP_SKILLS=0, in tests that do not assert the skill install');
});

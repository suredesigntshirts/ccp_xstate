// env-inherited: every command no-self-edit.test.mjs spawns gets the test's environment with HOME set to the test's
// temp home and no CLAUDE* or CCP* name but those the test sets itself; NODE_EXTRA_CA_CERTS and HTTPS_PROXY reach
// setup.sh. A stub bash first on PATH records what each bash run receives, and a NODE_OPTIONS preload records what
// each node child running the hook or release.mjs receives.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { NO_SELF_EDIT, REPO, nodeTest, temp } from './lib.mjs';

const ALLOWED = /^(CCP_SETUP_LOG|CLAUDE_PID|CCP_HARNESS_\w+|CLAUDE_PLUGIN_ROOT|CCP_REPO)$/;
const PROXY_MARK = 'http://secs-proxy.invalid:9';
const BASH = '/bin/bash';

test('env-inherited: setup.sh, the hook and release.mjs get the test environment, HOME the temp home, no foreign CLAUDE*/CCP*', (t) => {
  const d = temp(t, 'env');
  const bin = join(d, 'bin'), seen = join(d, 'seen');
  mkdirSync(bin);
  mkdirSync(seen);
  // Where no real proxy is set (CI), a marker is recorded, then dropped before the real bash runs, so npm ci is not
  // sent to a host that does not exist.
  const proxy = process.env.HTTPS_PROXY || PROXY_MARK;
  const ca = process.env.NODE_EXTRA_CA_CERTS || '/etc/ssl/certs/ca-certificates.crt';
  writeFileSync(join(bin, 'bash'), `#!${BASH}
env -0 > "${seen}/bash-$$-$RANDOM"
if [ "$HTTPS_PROXY" = "${PROXY_MARK}" ]; then exec env -u HTTPS_PROXY ${BASH} "$@"; fi
exec ${BASH} "$@"
`);
  chmodSync(join(bin, 'bash'), 0o755);
  writeFileSync(join(d, 'preload.cjs'), `const s = process.argv[1] || '';
if (/notice-behind\\.mjs$|release\\.mjs$/.test(s)) {
  require('fs').writeFileSync(${JSON.stringify(seen)} + '/node-' + process.pid,
    Object.entries(process.env).map(([k, v]) => k + '=' + v).join('\\0') + '\\0ARGV1=' + s);
}
`);
  const env = {
    ...process.env,
    PATH: `${bin}:${process.env.PATH}`,
    NODE_EXTRA_CA_CERTS: ca,
    HTTPS_PROXY: proxy,
    CLAUDE_SECS_X: 'from-the-thread',
    CCP_SECS_Y: 'from-the-thread',
    NODE_OPTIONS: `${process.env.NODE_OPTIONS ?? ''} --require ${join(d, 'preload.cjs')}`.trim(),
  };
  const r = nodeTest(REPO, NO_SELF_EDIT, { env });
  assert.equal(r.fail, 0, r.out.slice(-3000));
  assert.equal(r.pass, 6);

  const runs = readdirSync(seen).map((f) => ({
    f,
    vars: Object.fromEntries(readFileSync(join(seen, f), 'utf8').split('\0').filter(Boolean).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])),
  }));
  const setups = runs.filter((x) => x.f.startsWith('bash-'));
  const hooks = runs.filter((x) => /notice-behind\.mjs$/.test(x.vars.ARGV1 ?? ''));
  const releases = runs.filter((x) => /release\.mjs$/.test(x.vars.ARGV1 ?? ''));
  t.diagnostic(`bash runs ${setups.length}, hook runs ${hooks.length}, release.mjs runs ${releases.length}`);
  assert.ok(setups.length >= 8, `setup.sh ran under the stub (${setups.length} runs)`);
  assert.ok(hooks.length >= 1 && releases.length >= 2, 'the hook and both release.mjs runs were seen');
  for (const { f, vars } of runs) {
    assert.match(vars.HOME ?? '', /\/verify-noself-world-[^/]+\/home$/, `${f}: HOME is the test's temp home`);
    assert.equal(vars.NODE_EXTRA_CA_CERTS, ca, `${f}: NODE_EXTRA_CA_CERTS inherited`);
    assert.equal(vars.HTTPS_PROXY, proxy, `${f}: HTTPS_PROXY inherited`);
    assert.equal(vars.CLAUDE_SECS_X, undefined, `${f}: the thread's CLAUDE_* removed`);
    assert.equal(vars.CCP_SECS_Y, undefined, `${f}: the thread's CCP_* removed`);
    assert.deepEqual(Object.keys(vars).filter((k) => /^(CLAUDE|CCP)/.test(k) && !ALLOWED.test(k)), [], `${f}: only the test's own CLAUDE*/CCP* names`);
    assert.equal(vars.PATH?.split(':')[0], bin, `${f}: PATH inherited`);
  }
});

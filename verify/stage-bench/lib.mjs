// Verifier helpers for stage-bench (written by the verifier session, without reading scripts/bench/test/).
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const ADOPT = join(REPO, 'tournaments/2026-11-04-stage-contract/trials/adopt/journal');
export const ADOPT_PIN = '8dc9451a45169814fabaca1c7e91772f0ebf4452deb90aa57e1604750f2d394b';
export const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/** What `scripts/bench/run.mjs ... --prompt-only` prints: the prompt the bench would send. */
export const benchPrompt = (args, env = {}) =>
  execFileSync(process.execPath, [join(REPO, 'scripts/bench/run.mjs'), '--prompt-only', ...args], {
    cwd: REPO, encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 1 << 26
  });

/** A copy of the adopt journal's blobs, so loadWorkflow never writes into the committed journal. */
export function adoptBlobs() {
  const root = mkdtempSync(join(tmpdir(), 'v-sb-pin-'));
  cpSync(join(ADOPT, 'blobs'), join(root, 'blobs'), { recursive: true });
  return root;
}

// Shared by the faster-nested-test-runs suite: the shas it checked, the changed test files, and a reader for the
// json block of an evidence file.
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HERE = dirname(fileURLToPath(import.meta.url));
export const REPO = resolve(HERE, '..', '..');
/** The PR's merge base with main, and the head verified. */
export const BASE = '2009ca7f00aa68be82240b592dd1c8abbdfeea7d';
export const VERIFIED = 'ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f';

/** The test files the PR changes. */
export const FILES = [
  'packages/engine/test/bin.test.js',
  'packages/engine/test/standin.test.js',
  'test/regression/engine/moved-tests-bite.test.mjs',
  'test/regression/gates/build-sets-done.test.mjs',
  'test/regression/gates/contract-and-verdict-tests.test.mjs',
  'test/regression/gates/evidence-links-listings.test.mjs',
  'test/regression/gates/verdict-cutoff.test.mjs',
  'test/regression/inspector/reads-records.test.mjs',
  'test/regression/plan/lean-ready-head.test.mjs',
  'test/regression/plan/no-doing-status.test.mjs',
  'test/regression/plan/ready-rules-named.test.mjs',
  'test/regression/plugin/moved-tests-bite.test.mjs',
  'test/regression/plugin/self-edit-check.test.mjs',
  'test/regression/plugin/setup-install.test.mjs',
];

/** The object in the ```json block of verify/faster-nested-test-runs/evidence/<id>.md. */
export function evidence(id) {
  const text = readFileSync(join(HERE, 'evidence', `${id}.md`), 'utf8');
  const m = text.match(/```json\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`evidence/${id}.md has no json block`);
  return JSON.parse(m[1]);
}

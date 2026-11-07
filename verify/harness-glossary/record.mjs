#!/usr/bin/env node
// Records one checkout's answers for the verifier's comparisons: node record.mjs <checkout> <out folder>.
// Run against main to write evidence/main/; the tests run the same helpers live at the head.
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { captured, prepared, v1Reads } from './lib.mjs';

const [repo, out] = process.argv.slice(2).map((p) => resolve(p));
mkdirSync(out, { recursive: true });
const p = prepared(repo, 'record-prompt');
rmSync(join(out, 'run'), { recursive: true, force: true });
cpSync(p.dir, join(out, 'run'), { recursive: true });
const answers = {
  prepared: { run: p.run, files: p.files, file: p.file, text: p.text, stored: p.stored, spawned: null },
  captured: captured(repo, 'record-capture'),
  v1: await v1Reads(repo),
};
writeFileSync(join(out, 'answers.json'), `${JSON.stringify(answers, null, 2)}\n`);
console.log(`recorded ${repo} into ${out}`);

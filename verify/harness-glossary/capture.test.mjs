// capture-own-kinds: plugins/harness/scripts/capture.mjs at the head, driven with the hook inputs of a recorded session
// (one Agent call, its SubagentStart and SubagentStop), writes agent.prompt and agent.final rows with the payloads main's
// brief.stored and result.stored rows had (evidence/main/answers.json, recorded by record.mjs at main), and neither of
// those kinds; capture-rows.mjs holds neither kind.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EVIDENCE, REPO, captured } from './lib.mjs';

const MAIN = JSON.parse(readFileSync(join(EVIDENCE, 'main', 'answers.json'), 'utf8')).captured;
const HEAD = captured(REPO, 'capture-test');
const pick = (rows, kind) => rows.filter((r) => r.kind === kind);

test('capture-own-kinds: agent.prompt and agent.final carry what main\'s brief.stored and result.stored carried', (t) => {
  t.diagnostic(`main kinds: ${MAIN.map((r) => r.kind).join(',')}`);
  t.diagnostic(`head kinds: ${HEAD.map((r) => r.kind).join(',')}`);
  assert.equal(MAIN.every((r) => r.v === 1) && HEAD.every((r) => r.v === 2), true, 'main writes v1 rows, the head v2');
  const strip = ({ v, kind, ...rest }) => rest;
  const mainPrompt = pick(MAIN, 'brief.stored'), headPrompt = pick(HEAD, 'agent.prompt');
  const mainFinal = pick(MAIN, 'result.stored'), headFinal = pick(HEAD, 'agent.final');
  assert.equal(mainPrompt.length, 1);
  assert.equal(mainFinal.length, 1);
  assert.deepEqual(headPrompt.map(strip), mainPrompt.map(strip));
  assert.deepEqual(headFinal.map(strip), mainFinal.map(strip));
  t.diagnostic(`agent.prompt payload ${JSON.stringify(headPrompt[0].payload)}; agent.final payload ${JSON.stringify(headFinal[0].payload)}`);
  assert.deepEqual(pick(HEAD, 'brief.stored'), []);
  assert.deepEqual(pick(HEAD, 'result.stored'), []);
});

test('capture-own-kinds: every other row is the same, but agent.spawn names its hash promptHash', () => {
  const norm = (r) => {
    const { v, ...rest } = r;
    const kind = { 'brief.stored': 'agent.prompt', 'result.stored': 'agent.final' }[r.kind] ?? r.kind;
    let payload = r.payload;
    if (r.kind === 'agent.spawn' && 'briefHash' in payload) { const { briefHash, ...p } = payload; payload = { ...p, promptHash: briefHash }; }
    // hook.run carries the hook's own run time.
    if (r.kind === 'hook.run') payload = { ...payload, ms: 0 };
    return { ...rest, kind, payload };
  };
  assert.deepEqual(HEAD.map(norm), MAIN.map(norm));
  const spawn = pick(HEAD, 'agent.spawn')[0];
  assert.ok('promptHash' in spawn.payload && !('briefHash' in spawn.payload));
  assert.equal(spawn.payload.promptHash, pick(MAIN, 'agent.spawn')[0].payload.briefHash);
});

test('capture-own-kinds: capture-rows.mjs names neither brief.stored nor result.stored', () => {
  const src = readFileSync(join(REPO, 'plugins/harness/scripts/capture-rows.mjs'), 'utf8');
  assert.doesNotMatch(src, /brief\.stored|result\.stored/);
  assert.match(src, /kind: 'agent\.prompt'/);
  assert.match(src, /kind: 'agent\.final'/);
});

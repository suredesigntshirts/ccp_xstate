// Expect recorded (plan item prompt-catalogue): in a scripted run that hits refusals, send-backs and a stall, each
// journal row carries the entry name and slot values, and rendering that entry with those values gives the row's
// text. The run is scenario.mjs at this checkout (real bin/host.js and the plugin's actors.mjs as child processes).
// Also: stage.json names the catalogue entry of every piece rendered from one, the fixed frame pieces included.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { scenario } from './scenario.mjs';
import { entries, render } from '../../packages/engine/src/messages.js';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const s = await scenario(REPO);
const refusals = Object.values(s.rows).flat().filter((r) => r.kind === 'refusal');

test('recorded: the scripted run journals a refusal, a refusal cap, send-backs, no-returns, a stall, a stall cap and a cannot-start', () => {
  const rules = new Set(refusals.map((r) => r.payload.rule));
  for (const rule of ['schema', 'wrong-caller', 'already-returned', 'already-failed', 'refusal-cap', 'sent-back', 'no-return', 'stall', 'stall-cap', 'cannot-start']) assert.ok(rules.has(rule), `a ${rule} row`);
  assert.ok(refusals.length >= 20, `${refusals.length} rows`);
});

test('recorded: every refusal row carries { entry, slots }, and rendering them gives the row\'s reason byte for byte', () => {
  for (const r of refusals) {
    const m = r.payload.message;
    assert.ok(m && typeof m.entry === 'string' && m.slots && typeof m.slots === 'object', `${r.payload.rule} row has message: ${JSON.stringify(r.payload)}`);
    assert.ok(entries().has(m.entry), m.entry);
    assert.equal(render(m.entry, m.slots), r.payload.reason, `${r.payload.rule} ${m.entry}`);
  }
});

test('recorded: the row text the model got matches the hook output (stall and send-back blocks, deny reasons)', () => {
  const outs = s.out.filter((o) => o.out).map((o) => JSON.parse(o.out));
  const said = outs.map((o) => o.reason ?? o.hookSpecificOutput?.permissionDecisionReason).filter(Boolean).map(s.norm);
  for (const r of refusals.filter((x) => ['stall', 'sent-back'].includes(x.payload.rule))) assert.ok(said.includes(s.norm(r.payload.reason)), `${r.payload.rule} text was said`);
  // textHash is unchanged: the hash of the rule and reason, as before (sent-back and stall hash the text alone).
  for (const r of refusals) {
    const alone = ['sent-back', 'stall'].includes(r.payload.rule);
    const want = createHash('sha256').update(alone ? r.payload.reason : `${r.payload.rule}: ${r.payload.reason}`).digest('hex');
    assert.equal(r.payload.textHash, want, r.payload.rule);
  }
});

test('recorded: stage.json names the entry of each fixed frame piece and of the run context', () => {
  const runsDir = join(s.base, 'harness', 'journal', 'items', 'e-1', 'runs');
  const [run] = readdirSync(runsDir);
  const stage = JSON.parse(readFileSync(join(runsDir, run, 'stage.json'), 'utf8'));
  const pieces = JSON.stringify(stage);
  for (const entry of ['data-rule', 'worktree-rule', 'input-line', 'output-line', 'output-schema', 'return-line', 'run-line']) assert.ok(pieces.includes(`"entry":"${entry}"`), `stage.json names ${entry}`);
});

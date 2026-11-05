// Expect real-agent, from the verifier's own run (evidence/real-agent/): headless `claude -p --plugin-dir
// plugins/harness` (Claude Code 2.1.318) at head 2b0df32, a fresh HOME, CCP_HARNESS_DIR with install.json, GitHub as
// gh.mjs (PR o/r#1 at the worktree's HEAD). Items ra3 and ra4 were started with bin/host.js start (quick-fix), their
// brief run accepted by brief.mjs with the builder task, and the main session told to start `ccp-run <item>:1.build`.
// fix-agent.jsonl / cap-agent.jsonl are the build agents' transcripts; ra3.jsonl / ra4.jsonl the items' journals.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { HERE, outputLine } from './lib.mjs';

const EV = join(HERE, 'evidence', 'real-agent');
const lines = (f) => readFileSync(join(EV, f), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
function returns(f) {
  const uses = new Map();
  const out = [];
  for (const x of lines(f)) for (const b of Array.isArray(x.message?.content) ? x.message.content : []) {
    if (b.type === 'tool_use' && /harness__return$/.test(b.name)) uses.set(b.id, b.input);
    if (b.type === 'tool_result' && uses.has(b.tool_use_id)) {
      const text = typeof b.content === 'string' ? b.content : b.content.map((c) => c.text ?? '').join('');
      out.push({ input: uses.get(b.tool_use_id), text });
    }
  }
  return out;
}
const rowsOf = (f, run) => lines(f).filter((r) => r.payload?.run === run);

test('real-agent: fixed from the refusal alone; the hook accepted the next return', () => {
  const r = returns('fix-agent.jsonl');
  assert.equal(r[0].input.result.pr.at.length, 7);
  assert.ok(r[0].text.includes(`- pr: ${outputLine('build', 'pr')}`), 'deny has the pr hint');
  assert.ok(r[0].text.endsWith('Refusal 1 of 10.'), r[0].text);
  assert.equal(r[1].input.result.pr.at.length, 40);
  const rows = rowsOf('ra3.jsonl', 'ra3:1.build').filter((x) => /refusal|result.stored/.test(x.kind)).map((x) => `${x.kind}:${x.payload.rule ?? ''}`);
  assert.deepEqual(rows.slice(0, 2), ['refusal:schema', 'result.stored:'], 'the second return passed every check');
  // Advisory, not this item's: the return-tool server answered "not accepted" because result.json's hash is of the
  // stamped result (key, branch, checkout, green added), not of what the agent sent; the agent then retried.
  assert.match(r[1].text, /^not accepted/);
});

test('real-agent: the same bad result 10 times fails the run at the 10th, the deny says so, the item took onError', () => {
  const r = returns('cap-agent.jsonl');
  assert.equal(r.length, 10);
  r.forEach((x, i) => assert.ok(x.text.includes(`Refusal ${i + 1} of 10.`), `${i + 1}`));
  assert.match(r[9].text, /has failed after 10 refusals: do not call the return tool again/);
  const rows = rowsOf('ra4.jsonl', 'ra4:1.build');
  assert.deepEqual(rows.filter((x) => x.kind === 'refusal').map((x) => x.payload.rule), [...Array(10).fill('schema'), 'refusal-cap']);
  assert.match(JSON.parse(readFileSync(join(EV, 'ra4-failed.json'), 'utf8')).why, /^refused 10 times/);
  const last = lines('ra4.jsonl').filter((x) => x.kind === 'engine.transition' && x.payload.outcome === 'applied').at(-1);
  assert.equal(last.payload.event.type, 'xstate.error.actor.build');
  assert.match(last.payload.event.error, /^refused 10 times/);
  assert.ok(last.payload.writes.some((w) => w.set === '/states/building/invoke/onError/actions/0'), 'taken by building\'s onError');
  // host.js show --item ra4 printed state "replanning" after the run (building's onError target).
});

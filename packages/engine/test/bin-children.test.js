// bin/host.js drives an item and its child items: a feature item's slices start as quick-fix children in the same call
// that takes the plan, their runs are listed with their item, and the start records who picked the workflow.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import { accept, bind, spawn } from '../src/actors.js';
import { readFile } from '../../journal/src/index.js';
import { itemFile } from '../src/names.js';

const cli = new URL('../bin/host.js', import.meta.url).pathname;

const scratch = () => {
  const parent = mkdtempSync(join(tmpdir(), 'engine-children-'));
  process.on('exit', () => rmSync(parent, { recursive: true, force: true }));
  const repo = join(parent, 'repo');
  execFileSync('git', ['init', '-q', repo]);
  execFileSync('git', ['-C', repo, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'empty']);
  return { root: join(parent, 'journal'), repo };
};

const host = ({ root, repo }, args, { workflow = 'feature', item = 'f', input = '', ok = true } = {}) => {
  const out = spawnSync(process.execPath, [cli, ...args, '--item', item, '--workflow', workflow, '--root', root, '--release', '0.2.0', '--repo', repo], { input, encoding: 'utf8', cwd: repo });
  if (!ok) return out;
  assert.equal(out.status, 0, out.stderr);
  return JSON.parse(out.stdout);
};

const GOAL = { url: 'https://github.com/o/r/issues/9', expect: ['a holds', 'b holds', 'c holds'] };
const START = ['start', '--session', 'owner', '--input', JSON.stringify({ issue: GOAL, branch: 'feat' }), '--selected-by', 'the person', '--how', 'named it in the thread'];

// What an agent does through the real hooks: its run is spawned and bound, and its result goes through accept().
const returns = async ({ root }, run, result) => {
  const tool = `toolu_${run.replace(/[^\w-]/g, '_')}`;
  spawn({ root, prompt: `ccp-run ${run}`, toolUseId: tool });
  bind({ root, agentId: `ag_${tool}`, toolUseId: tool });
  return accept({ root, caller: `ag_${tool}`, run, result, toolUseId: `${tool}-ret` });
};

test('the start records the pinned workflow and who picked it, and a later start is refused', () => {
  const w = scratch();
  const out = host(w, START);
  assert.equal(out.state, 'planning');
  const [first] = readFile(itemFile(w.root, 'f')).rows;
  assert.match(first.payload.selection.workflow, /^feature@[0-9a-f]{64}$/);
  assert.equal(first.payload.selection.workflow, first.payload.workflow);
  assert.deepEqual([first.payload.selection.by, first.payload.selection.how], ['the person', 'named it in the thread']);

  // From the owner's session (a builder agent inside it) the start's source was offered already; from any other
  // session the item is not its own. Either way nothing applies.
  for (const [session, outcome] of [['owner', 'duplicate'], ['builder', 'not-owner']]) {
    const again = host(w, ['start', '--session', session, '--input', JSON.stringify({ issue: GOAL }), '--selected-by', 'a builder'], { workflow: 'quick-fix' });
    assert.deepEqual(again.results.map((r) => r.outcome), [outcome]);
    assert.equal(again.state, 'planning');
  }
  const rows = readFile(itemFile(w.root, 'f')).rows;
  assert.ok(rows.every((r) => r.kind !== 'engine.transition' || r.payload.workflow === first.payload.workflow));
});

test('a start without --selected-by names its source as who picked it', () => {
  const w = scratch();
  host(w, ['start', '--session', 'owner', '--input', JSON.stringify({ issue: GOAL })], { workflow: 'quick-fix', item: 'q' });
  const [first] = readFile(itemFile(w.root, 'q')).rows;
  assert.deepEqual(first.payload.selection.by, 'claude-code owner');
  assert.equal(first.payload.selection.how, null);
  assert.equal(host(w, ['start', '--session', 'owner', '--input', '{}', '--how', 'x'], { workflow: 'quick-fix', item: 'q2', ok: false }).status, 2);
});

test("the plan starts three quick-fix children in the same call, and their runs are listed with their item", async () => {
  const w = scratch();
  const started = host(w, START);
  const [brief] = started.waiting;
  assert.equal(brief.actor, 'brief');
  const slices = ['a', 'b', 'c'].map((x, i) => ({ url: `${GOAL.url}#s${i + 1}`, expect: [`${x} holds`] }));
  const accepted = await returns(w, brief.run, { slices });
  assert.ok(accepted.ok ?? !accepted.refused, JSON.stringify(accepted));

  const out = host(w, ['wake'], { input: JSON.stringify({ session_id: 'owner', hook_event_name: 'UserPromptSubmit', prompt: 'go on' }) });
  assert.equal(out.state, 'slicing');
  assert.equal(out.children.length, 3);
  for (const child of out.children) {
    assert.match(child.workflow, /^quick-fix@/);
    assert.equal(child.state, 'briefing');
  }
  const childBriefs = out.waiting.filter((r) => r.item);
  assert.deepEqual(childBriefs.map((r) => r.actor), ['brief', 'brief', 'brief']);
  assert.deepEqual(childBriefs.map((r) => r.item), out.children.map((c) => c.item));

  // A child's start names the parent's run as who picked its workflow.
  const [childStart] = readFile(itemFile(w.root, out.children[0].item)).rows;
  assert.equal(childStart.payload.selection.by, `item ${out.children[0].item}`);

  // show lists the same tree without offering anything.
  const shown = host(w, ['show']);
  assert.deepEqual(shown.children.map((c) => c.item), out.children.map((c) => c.item));
  assert.deepEqual(shown.results, []);
});

test('an --effect that is no run of the item or its open children is refused', () => {
  const w = scratch();
  host(w, START);
  const out = host(w, ['card', '--effect', 'other:1.ask', '--ref', 'c1'], { ok: false });
  assert.equal(out.status, 2);
  assert.match(out.stderr, /not a run of f/);
});

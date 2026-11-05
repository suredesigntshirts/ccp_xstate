// Expect pin: changing one line of a stage file changes the id (name@sha256) a new item pins; an item pinned before
// the change still loads, replays and renders its prompts from its blob alone, with the stage files deleted; every
// committed journal still replays (test/journals-replay.test.mjs, run as a child).
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';

import { loadWorkflow, workflowOf } from '../../packages/engine/src/index.js';
import { applyEvent, persist, restore } from '../../packages/engine/src/host.js';
import { REPO, readJson, renderOn, scratchWorkflows } from './lib.mjs';
import { prepareRun } from '../../scripts/bench/lib.mjs';

const ISSUE = { url: 'https://github.com/o/r/issues/1', title: 'v', body: 'b', expect: ['npm test passes', 'README.md says hello'] };

/** Edit one line of a stage file in place: a rule line gets words appended. Returns the old and new line. */
function editOneLine(dir, rel, startsWith) {
  const p = join(dir, rel);
  const lines = readFileSync(p, 'utf8').split('\n');
  const i = lines.findIndex((l) => l.startsWith(startsWith));
  assert.ok(i >= 0, `${rel}: a line starting ${startsWith}`);
  const old = lines[i];
  lines[i] = `${old} Keep it short.`;
  writeFileSync(p, lines.join('\n'));
  return { old, line: i + 1 };
}

test('one changed line in each kind of stage-file text changes the pinned id', () => {
  const dir = scratchWorkflows();
  const before = loadWorkflow('quick-fix', { dir }).id;
  assert.match(before, /^quick-fix@[0-9a-f]{64}$/);
  // same files, same id (the pin is a function of the files)
  assert.equal(loadWorkflow('quick-fix', { dir: scratchWorkflows() }).id, before);
  const seen = new Set([before]);
  for (const [rel, start, wf] of [
    ['quick-fix/brief.md', '- Use paths', 'quick-fix'], // a rule
    ['quick-fix/build.md', '- previous:', 'quick-fix'], // an input meaning
    ['quick-fix/verify.md', '- lines:', 'quick-fix'], // an output description
    ['quick-fix/brief.md', 'Write the two briefs', 'quick-fix'], // the task
    ['research/researcher.md', '- Open no pull request', 'research'],
    ['feature/brief.md', '- ', 'feature']
  ]) {
    const was = wf === 'quick-fix' ? [...seen].at(-1) : loadWorkflow(wf, { dir }).id;
    editOneLine(dir, rel, start);
    const now = loadWorkflow(wf, { dir }).id;
    assert.notEqual(now, was, `${rel} ${start}`);
    if (wf === 'quick-fix') { assert.ok(!seen.has(now)); seen.add(now); }
  }
});

test('an item pinned before the edit loads, replays and renders from its blob alone, stage files deleted', async () => {
  const dir = scratchWorkflows();
  const root = mkdtempSync(join(tmpdir(), 'v-spf-item-'));
  const item = 'v-pin';
  const spec = loadWorkflow('quick-fix', { root, dir });
  const pin = spec.id;
  assert.ok(existsSync(join(root, 'blobs', pin.split('@')[1])), 'the composed blob is stored at pin time');
  // Start the item through the real host (as the bench does): seq 0, the brief run's folder with its brief.md.
  const work = mkdtempSync(join(tmpdir(), 'v-spf-repo-'));
  execFileSync('git', ['init', '-q', '-b', 'main', join(work, 'repo')]);
  writeFileSync(join(work, 'repo/README.md'), 'hi\n');
  execFileSync('git', ['-C', join(work, 'repo'), 'add', '-A']);
  execFileSync('git', ['-C', join(work, 'repo'), '-c', 'user.email=v@v', '-c', 'user.name=v', 'commit', '-q', '-m', 'seed']);
  const prepared = await prepareRun({ spec, actor: 'brief', item, root, repo: join(work, 'repo'), worktrees: join(work, 'wt'), caseInput: { issue: ISSUE } });
  // A second applied transition: the brief's result moves the item to building.
  const host = restore({ root, item, spec, session: 'bench', release: '0.0.0' });
  const r = applyEvent(host, { event: { type: 'xstate.done.actor.brief', output: { builder: 'Do the steps.', verifier: 'Check each line.' } }, source: { system: 'verifier-test', ref: 'r1' }, run: prepared.run });
  assert.equal(r.outcome, 'applied', JSON.stringify(r.row?.payload?.reason));
  persist(host, r.row);
  const rows = readFileSync(join(root, 'items', `${item}.jsonl`), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const applied = rows.filter((x) => x.kind === 'engine.transition' && x.payload.outcome === 'applied');
  assert.equal(applied.length, 2);
  assert.ok(applied.every((x) => x.payload.workflow === pin));

  // Now change one stage-file line: a new item would pin another id.
  editOneLine(dir, 'quick-fix/brief.md', '- Use paths');
  const edited = loadWorkflow('quick-fix', { dir });
  assert.notEqual(edited.id, pin);
  // Then delete every stage file (and folder) of every workflow.
  for (const w of ['quick-fix', 'research', 'feature']) rmSync(join(dir, w), { recursive: true });
  assert.ok(!existsSync(join(dir, 'quick-fix/brief.md')));
  assert.throws(() => loadWorkflow('quick-fix', { dir }), /stage file|ENOENT/, 'the plain name cannot load without its files');

  const back = loadWorkflow(pin, { root, dir });
  assert.equal(back.id, pin);
  const viaJournal = workflowOf(root, item);
  assert.equal(viaJournal.id, pin);
  const replayed = restore({ root, item, spec: back, session: 'v', release: '0' });
  assert.equal(replayed.seq, 2);
  assert.deepEqual(replayed.snapshot.value, host.snapshot.value);
  const rj = readJson(join(prepared.dir, 'run.json'));
  const committed = readFileSync(join(prepared.dir, 'brief.md'), 'utf8');
  assert.equal(renderOn(back, 'brief', rj.input, rj.run), committed, 'brief.md from the blob alone');
  assert.notEqual(renderOn(edited, 'brief', rj.input, rj.run), committed, 'the edit changes the prompt');
  // the blob holds the words themselves, not a pointer to a file
  const blob = readFileSync(join(root, 'blobs', pin.split('@')[1]), 'utf8');
  assert.ok(blob.includes('Use paths from the repository root.') && blob.includes('Write the two briefs for issue.'));
});

test('every committed journal still replays (test/journals-replay.test.mjs)', () => {
  const out = execFileSync(process.execPath, ['--test', '--test-reporter=tap', join(REPO, 'test/journals-replay.test.mjs')], { cwd: REPO, encoding: 'utf8', env: Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== 'NODE_TEST_CONTEXT')) });
  const pass = Number(/^# pass (\d+)/m.exec(out)?.[1]);
  const fail = Number(/^# fail (\d+)/m.exec(out)?.[1]);
  console.log(`journals-replay: pass ${pass}, fail ${fail}`);
  assert.equal(fail, 0);
  assert.ok(pass >= 50, `pass ${pass}`);
});

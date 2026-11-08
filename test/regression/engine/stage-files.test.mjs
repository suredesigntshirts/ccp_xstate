// Expect: stage-prompt-files/load-check, stage-prompt-files/pin
// Stage prompt files beside the workflow JSON: a file with a missing or unknown section, a name that is not one of the
// stage's inputs or output properties, an output field out of order, a ## Task no invoke wires or a missing file is
// refused at load naming the file and line; changing one line of a stage file changes the id a new item pins, and an item
// pinned before the change still loads, replays and renders from its blob alone.
import { execFileSync } from 'node:child_process';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow, workflowOf } from '../../../packages/engine/src/index.js';
import { render } from '../../../packages/engine/src/stages.js';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { applyEvent, persist, restore } from '../../../packages/engine/src/host.js';
import { prepareRun } from '../../../scripts/bench/lib.mjs';

const REPO = new URL('../../..', import.meta.url).pathname;
const readJson = (f) => JSON.parse(readFileSync(f, 'utf8'));

/** A scratch copy of this checkout's workflows/ (with the stage folders). */
function scratchWorkflows() {
  const dir = mkdtempSync(join(tmpdir(), 'v-spf-wf-'));
  cpSync(join(REPO, 'workflows'), dir, { recursive: true });
  return dir;
}

const load = (name, dir) => loadWorkflow(name, { dir });


const renderOn = (spec, actor, input, run) =>
  render({ actor, schema: spec.meta.actors[actor], input, defs: spec.meta.schemas ?? {}, run });

/** Load quick-fix after `edit` changed `rel` (null removes it); the error, or null when it loaded. */
function tryLoad(rel, edit, wf = 'quick-fix') {
  const dir = scratchWorkflows();
  const p = join(dir, rel);
  if (edit) {
    const before = readFileSync(p, 'utf8');
    const after = edit(before);
    assert.notEqual(after, before, `the edit changed ${rel}`);
    writeFileSync(p, after);
  } else rmSync(p);
  try {
    loadWorkflow(wf, { dir });
    return { loaded: true, text: edit ? readFileSync(p, 'utf8') : null };
  } catch (error) {
    return { loaded: false, message: error.message, text: edit ? readFileSync(p, 'utf8') : null };
  }
}
/** The 1-based line of the first line of `text` matching re. */
const lineOf = (text, re) => text.split('\n').findIndex((l) => re.test(l)) + 1;

/** Refused, naming workflows/<rel> and (when `line` is given) that line. */
function refused(r, rel, line) {
  assert.equal(r.loaded, false, `${rel} loaded`);
  if (line == null) assert.ok(r.message.includes(`workflows/${rel}`), r.message);
  else assert.ok(r.message.includes(`workflows/${rel}:${line}:`), `want workflows/${rel}:${line}: in: ${r.message}`);
}

test('unknown section: ## Notes in build.md is refused at its line', () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace('## Inputs', '## Notes\n\n- a note\n\n## Inputs'));
  refused(r, 'quick-fix/build.md', lineOf(r.text, /^## Notes$/));
});

test('input name in research researcher that is not its input is refused at its line', () => {
  const r = tryLoad('research/researcher.md', (t) => t.replace(/^- question:/m, '- query:'), 'research');
  refused(r, 'research/researcher.md', lineOf(r.text, /^- query:/));
});

test('unknown section: a ### sub-heading under Rules is refused at its line', () => {
  const r = tryLoad('quick-fix/verify.md', (t) => t.replace('## Inputs', '### More\n\n## Inputs'));
  refused(r, 'quick-fix/verify.md', lineOf(r.text, /^### More$/));
});

test('missing section: build.md without ## Rules', () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace(/## Rules\n[\s\S]*?(?=## Inputs)/, ''));
  refused(r, 'quick-fix/build.md', r.text.split('\n').length);
});

test('missing section: brief.md without ## Inputs', () => {
  const r = tryLoad('quick-fix/brief.md', (t) => t.replace(/## Inputs\n[\s\S]*?(?=## Output)/, ''));
  refused(r, 'quick-fix/brief.md', r.text.split('\n').length);
});

test('missing section: brief.md without ## Task, which its invoke wires', () => {
  const r = tryLoad('quick-fix/brief.md', (t) => t.replace(/## Task\n[\s\S]*$/, ''));
  refused(r, 'quick-fix/brief.md', r.text.split('\n').length);
});

test('missing section: brief.md without ## Output', () => {
  const r = tryLoad('quick-fix/brief.md', (t) => t.replace(/## Output\n[\s\S]*?(?=## Task)/, ''));
  refused(r, 'quick-fix/brief.md', r.text.split('\n').length);
});

test('missing Output line: verify.md without its - pr: line is refused at the ## Output heading', () => {
  const r = tryLoad('quick-fix/verify.md', (t) => t.replace(/^- pr:.*\n/m, ''));
  refused(r, 'quick-fix/verify.md', lineOf(r.text, /^## Output$/));
});

test('missing Inputs line: build.md without its - previous: line is refused at the ## Inputs heading', () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace(/^- previous:.*\n/m, ''));
  refused(r, 'quick-fix/build.md', lineOf(r.text, /^## Inputs$/));
});

test('output name that is not an output property is refused at its line', () => {
  const r = tryLoad('quick-fix/verify.md', (t) => t.replace(/^- pr:/m, '- pull:'));
  refused(r, 'quick-fix/verify.md', lineOf(r.text, /^- pull:/));
});

test('input name that is not one of the stage\'s inputs (an extra one) is refused at its line', () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace(/^- previous:/m, '- earlier: the earlier PR\n- previous:'));
  refused(r, 'quick-fix/build.md', lineOf(r.text, /^- earlier:/));
});

test('input name that is not one of the stage\'s inputs (a misspelt one) is refused at its line', () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace(/^- previous:/m, '- previus:'));
  refused(r, 'quick-fix/build.md', lineOf(r.text, /^- previus:/));
});

test('output field out of the schema order is refused at its line', () => {
  const r = tryLoad('quick-fix/verify.md', (t) => {
    const a = t.match(/^- result:.*\n/m)[0];
    const b = t.match(/^- pr:.*\n/m)[0];
    return t.replace(a, '\u0000').replace(b, a).replace('\u0000', b);
  });
  refused(r, 'quick-fix/verify.md', lineOf(r.text, /^- result:/));
});

test('## Task in a stage no invoke wires a task to (quick-fix build) is refused at its line', () => {
  const r = tryLoad('quick-fix/build.md', (t) => `${t.trimEnd()}\n\n## Task\n\nBuild it.\n`);
  const at = lineOf(r.text, /^## Task$/);
  assert.equal(r.loaded, false);
  assert.match(r.message, new RegExp(`workflows/quick-fix/build\\.md:(${at}|${at + 2}):`), r.message);
});

test('## Task in research researcher (task wired from the planner, not the file) is refused', () => {
  const r = tryLoad('research/researcher.md', (t) => `${t.trimEnd()}\n\n## Task\n\nResearch it.\n`, 'research');
  assert.equal(r.loaded, false, 'loaded');
  assert.match(r.message, /workflows\/research\/researcher\.md:\d+:/, r.message);
});

test('missing file: quick-fix/build.md deleted is refused naming the file', () => {
  const r = tryLoad('quick-fix/build.md', null);
  refused(r, 'quick-fix/build.md');
});

test('missing file: research/write.md deleted is refused naming the file', () => {
  const r = tryLoad('research/write.md', null, 'research');
  refused(r, 'research/write.md');
});

test('control: an untouched scratch copy loads', () => {
  for (const w of ['quick-fix', 'research', 'feature']) loadWorkflow(w, { dir: scratchWorkflows() });
});

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
  const committed = readFileSync(join(prepared.dir, 'prompt.md'), 'utf8');
  assert.equal(renderOn(back, 'brief', rj.input, rj.run), committed, 'prompt.md from the blob alone');
  assert.notEqual(renderOn(edited, 'brief', rj.input, rj.run), committed, 'the edit changes the prompt');
  // the blob holds the words themselves, not a pointer to a file
  const blob = readFileSync(join(root, 'blobs', pin.split('@')[1]), 'utf8');
  assert.ok(blob.includes('Use paths from the repository root.') && blob.includes('Write the two briefs for issue.'));
});



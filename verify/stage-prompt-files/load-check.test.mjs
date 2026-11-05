// Expect load-check: a stage file with a missing or unknown section, a name that is not one of the stage's inputs or
// output properties, an output field out of the schema's order, a ## Task for a stage no invoke wires a task to, or a
// missing file is refused at load with an error naming the file and line. My own malformed files, each in a scratch
// copy of workflows/, loaded with loadWorkflow (what the host and the bench call).
//
// A case the head does not meet is a todo test (it runs and reports, but does not turn npm test red); the verdict
// marks the Expect NOT MET and names those cases.
import assert from 'node:assert/strict';
import { readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { loadWorkflow } from '../../packages/engine/src/index.js';
import { scratchWorkflows } from './lib.mjs';

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

const NOT_MET = {
  missingOutput: 'head loads a brief.md with no ## Output section: the output descriptions drop out of the prompt silently',
  inputName: 'head refuses an Inputs name that is not an input, but the error ("quick-fix@<sha>: stage build invoke build inputs differ") names neither the file nor the line'
};

test('unknown section: ## Notes in build.md is refused at its line', () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace('## Inputs', '## Notes\n\n- a note\n\n## Inputs'));
  refused(r, 'quick-fix/build.md', lineOf(r.text, /^## Notes$/));
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
  refused(r, 'quick-fix/brief.md'); // the head names the file; no line (the section is absent)
  console.log(`missing ## Task: ${r.message}`);
});

test('missing section: brief.md without ## Output', { todo: NOT_MET.missingOutput }, () => {
  const r = tryLoad('quick-fix/brief.md', (t) => t.replace(/## Output\n[\s\S]*?(?=## Task)/, ''));
  console.log(`missing ## Output: ${r.loaded ? 'LOADED' : r.message}`);
  refused(r, 'quick-fix/brief.md');
});

test('output name that is not an output property is refused at its line', () => {
  const r = tryLoad('quick-fix/verify.md', (t) => t.replace(/^- pr:/m, '- pull:'));
  refused(r, 'quick-fix/verify.md', lineOf(r.text, /^- pull:/));
});

test('input name that is not one of the stage\'s inputs (an extra one) is refused at its line', { todo: NOT_MET.inputName }, () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace(/^- previous:/m, '- earlier: the earlier PR\n- previous:'));
  console.log(`extra input: ${r.loaded ? 'LOADED' : r.message}`);
  refused(r, 'quick-fix/build.md', lineOf(r.text, /^- earlier:/));
});

test('input name that is not one of the stage\'s inputs (a misspelt one) is refused at its line', { todo: NOT_MET.inputName }, () => {
  const r = tryLoad('quick-fix/build.md', (t) => t.replace(/^- previous:/m, '- previus:'));
  console.log(`misspelt input: ${r.loaded ? 'LOADED' : r.message}`);
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

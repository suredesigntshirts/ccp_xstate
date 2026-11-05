// Stage files (plan item stage-prompt-files): each model stage's words live in workflows/<workflow>/<stage>.md. The
// engine fills them into the spec it runs on, pins the filled spec, refuses a malformed file naming its line, and every
// run's stage.json names the file and line of each piece that came from one.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadWorkflow, readWorkflow, parseStageFile, compose } from '../src/index.js';
import { stagesOf } from '../src/stages.js';
import { runDir } from '../src/actors.js';
import { makeWorld, ISSUE } from './tourney/world.js';

const WORKFLOWS = new URL('../../../workflows/', import.meta.url).pathname;
const NAMES = ['quick-fix', 'research', 'feature'];
const copy = () => {
  const dir = mkdtempSync(join(tmpdir(), 'stage-files-'));
  cpSync(WORKFLOWS, dir, { recursive: true });
  return dir;
};
const edit = (dir, rel, f) => writeFileSync(join(dir, rel), f(readFileSync(join(dir, rel), 'utf8')));

test('every model stage of every workflow names its own stage file, and the JSON holds none of its words', () => {
  for (const name of NAMES) {
    const raw = JSON.parse(readFileSync(join(WORKFLOWS, `${name}.json`), 'utf8'));
    const spec = loadWorkflow(name);
    const files = readdirSync(join(WORKFLOWS, name)).sort();
    assert.deepEqual(files, stagesOf(spec).map((s) => `${s}.md`).sort(), `${name}: one file per stage`);
    for (const stage of stagesOf(spec)) {
      const entry = raw.meta.actors[stage];
      assert.equal(entry.prompt, `${name}/${stage}.md`);
      assert.ok(!('rules' in entry) && !('inputs' in entry), `${name}.${stage}: no rules or inputs in the JSON`);
      for (const p of Object.values(entry.properties)) assert.ok(!('description' in p), `${name}.${stage}: no description in the JSON`);
    }
    assert.ok(!JSON.stringify(raw.states).includes('"value":"Write') && !/"task": \{ "value"/.test(readFileSync(join(WORKFLOWS, `${name}.json`), 'utf8')), `${name}: no task literal in the JSON`);
  }
});

test('the pin hashes the stage files: a one-line edit changes the id, and the old pin still loads from its blob alone', () => {
  const dir = copy();
  const root = mkdtempSync(join(tmpdir(), 'stage-files-root-'));
  try {
    const before = loadWorkflow('quick-fix', { root, dir });
    edit(dir, 'quick-fix/brief.md', (t) => t.replace('Use paths from the repository root.', 'Use repository-root paths.'));
    const after = loadWorkflow('quick-fix', { dir });
    assert.notEqual(after.id, before.id);
    assert.ok(after.meta.actors.brief.rules.includes('Use repository-root paths.'));
    rmSync(join(dir, 'quick-fix'), { recursive: true });
    const pinned = loadWorkflow(before.id, { root, dir });
    assert.ok(pinned.meta.actors.brief.rules.includes('Use paths from the repository root.'), 'the blob holds the words');
    assert.equal(pinned.meta.prompts['/meta/actors/brief/rules/4'].file, 'workflows/quick-fix/brief.md');
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(root, { recursive: true, force: true });
  }
});

test('the composed bytes written as one file pin the same id as the JSON and its stage files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'stage-files-one-'));
  try {
    for (const name of NAMES) writeFileSync(join(dir, `${name}.json`), readWorkflow(name, { dir: WORKFLOWS }).bytes);
    for (const name of NAMES) assert.equal(loadWorkflow(name, { dir }).id, loadWorkflow(name).id);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('a malformed stage file is refused at load, naming the file and line', () => {
  const cases = [
    ['quick-fix/brief.md', (t) => t.replace('# brief\n', '# briefs\n'), /workflows\/quick-fix\/brief\.md:1: the file must start with the title line "# brief"/],
    ['quick-fix/brief.md', (t) => t.replace('## Inputs', '## Notes'), /workflows\/quick-fix\/brief\.md:\d+: unknown heading "## Notes"/],
    ['quick-fix/brief.md', (t) => t.replace('\n## Rules\n', '\nSome prose.\n\n## Rules\n'), /brief\.md:3: text outside a section/],
    ['quick-fix/brief.md', (t) => t.replace('- Use paths from the repository root.', '- Use paths from\n  the repository root.'), /brief\.md:\d+: a Rules item is one line starting "- ": an item cannot wrap/],
    ['quick-fix/build.md', (t) => t.replace('- notes:', '- note:'), /build\.md:\d+: note is not an output property of build/],
    ['quick-fix/verify.md', (t) => { const [a, b] = [t.match(/^- result: .*$/m)[0], t.match(/^- pr: .*$/m)[0]]; return t.replace(a, '@@').replace(b, a).replace('@@', b); }, /verify\.md:\d+: result is out of order/],
    ['quick-fix/build.md', (t) => `${t}\n## Task\n\nDo it.\n`, /build\.md:\d+: ## Task, but no invoke wires/],
    ['quick-fix/brief.md', (t) => t.replace(/## Rules[\s\S]*?## Inputs/, '## Inputs'), /brief\.md:\d+: no ## Rules section/],
    ['quick-fix/brief.md', (t) => t.replace('## Inputs', '## Output\n\n## Inputs'), /brief\.md:\d+: ## Inputs is out of order/]
  ];
  for (const [rel, f, re] of cases) {
    const dir = copy();
    try {
      edit(dir, rel, f);
      assert.throws(() => loadWorkflow('quick-fix', { dir }), re, `${rel}: ${re}`);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
  const dir = copy();
  try {
    rmSync(join(dir, 'quick-fix/verify.md'));
    assert.throws(() => loadWorkflow('quick-fix', { dir }), /stage verify: cannot read its stage file workflows\/quick-fix\/verify\.md: ENOENT/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('words in both the JSON and the stage file, or a task source with no ## Task, are refused', () => {
  const raw = JSON.parse(readFileSync(join(WORKFLOWS, 'quick-fix.json'), 'utf8'));
  const both = structuredClone(raw);
  both.meta.actors.brief.rules = ['x'];
  assert.throws(() => compose(both, { dir: WORKFLOWS, name: 'quick-fix' }), /also has rules in the JSON/);
  const described = structuredClone(raw);
  described.meta.actors.build.properties.pr.description = 'x';
  assert.throws(() => compose(described, { dir: WORKFLOWS, name: 'quick-fix' }), /also describes output pr in the JSON/);
  const noTask = structuredClone(raw);
  noTask.states.building.invoke.input.task = { prompt: 'task' };
  assert.throws(() => compose(noTask, { dir: WORKFLOWS, name: 'quick-fix' }), /quick-fix\/build\.md has no ## Task section/);
  const outside = structuredClone(raw);
  outside.meta.actors.brief.prompt = '../brief.md';
  assert.throws(() => compose(outside, { dir: WORKFLOWS, name: 'quick-fix' }), /prompt must be a \.md path inside the workflow folder/);
});

test('parseStageFile keeps a multi-line task as written, and the line it starts on', () => {
  const p = parseStageFile('# s\n\n## Rules\n\n- r\n\n## Inputs\n\n- task: t\n\n## Task\n\nline one\n\nline three\n\n', { file: 'f.md', stage: 's' });
  assert.deepEqual(p.task, { text: 'line one\n\nline three', line: 13 });
  assert.deepEqual(p.rules, [{ text: 'r', line: 5 }]);
});

test("a run's stage.json names the stage file and line of every rule, output description, input meaning and the task", async () => {
  const w = await makeWorld();
  try {
    await w.start('q1', 'quick-fix', { issue: ISSUE });
    const run = w.openRun('q1', 'brief').id;
    const rec = JSON.parse(readFileSync(join(runDir(w.root, run), 'stage.json'), 'utf8'));
    const file = readFileSync(join(WORKFLOWS, 'quick-fix/brief.md'), 'utf8').split('\n');
    const lineAt = (n) => file[n - 1];
    const { rules, output, task, inputs } = rec.prompt.parts;
    for (const p of rules.filter((x) => x.source.workflow)) {
      assert.equal(p.source.file, 'workflows/quick-fix/brief.md');
      assert.equal(lineAt(p.source.line), p.text, 'a rule is its file line');
    }
    assert.equal(rules.filter((x) => x.source.file).length, 6);
    for (const p of output.filter((x) => x.source.workflow?.endsWith('/description'))) assert.equal(lineAt(p.source.line), p.text);
    assert.equal(output.filter((x) => x.source.file).length, 2);
    assert.equal(task[0].source.file, 'workflows/quick-fix/brief.md');
    assert.equal(lineAt(task[0].source.line), task[0].text);
    for (const p of inputs) assert.ok(lineAt(p.source.meaningLine).startsWith(`- ${p.source.input}: `), `${p.source.input}: its meaning's line`);
    for (const i of rec.inputs) assert.equal(i.meaningFile, 'workflows/quick-fix/brief.md');
  } finally {
    await w.close();
  }
});

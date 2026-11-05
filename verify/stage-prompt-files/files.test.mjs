// Expect files: each of the 8 model stages has workflows/<workflow>/<stage>.md holding its rules, input meanings,
// output descriptions and (for the three brief stages) its task; no meta.actors entry in workflows/*.json holds rules,
// inputs or a top-level property description, and no invoke holds a task literal. Read with my own reader, not the
// engine's parser: every word the base commit kept in the JSON must be in the file, under its heading, and the file
// must hold nothing else.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { REPO, STAGES, WORKFLOWS, baseRaw, invokeOf, readJson, stagesOf, load, baseWorkflows } from './lib.mjs';

/** A stage file split by ## heading: { title, sections: { Rules: [lines], ... } }, blank lines dropped except in Task. */
function sectionsOf(text) {
  const lines = text.split('\n');
  const out = { title: null, order: [], sections: {} };
  let cur = null;
  for (const l of lines) {
    if (out.title == null) { if (l.trim()) out.title = l; continue; }
    if (l.startsWith('## ')) { cur = l.slice(3); out.order.push(cur); out.sections[cur] = []; continue; }
    assert.ok(cur != null || !l.trim(), `text before a section: ${l}`);
    if (cur) out.sections[cur].push(l);
  }
  return out;
}
const items = (ls) => ls.filter((l) => l.trim());

const allInvokes = (node, found = []) => {
  for (const st of Object.values(node?.states ?? {})) {
    for (const inv of [st.invoke ?? []].flat()) found.push(inv);
    allInvokes(st, found);
  }
  return found;
};

test('the 8 model stages, on the base JSON and on the head composed from files', () => {
  const baseDir = baseWorkflows();
  for (const w of WORKFLOWS) {
    assert.deepEqual(stagesOf(load(w, baseDir)).sort(), [...STAGES[w]].sort(), `base ${w}`);
    assert.deepEqual(stagesOf(load(w, join(REPO, 'workflows'))).sort(), [...STAGES[w]].sort(), `head ${w}`);
  }
  assert.equal(Object.values(STAGES).flat().length, 8);
});

for (const w of WORKFLOWS) {
  const raw = readJson(join(REPO, 'workflows', `${w}.json`));
  const base = baseRaw(w);

  test(`${w}.json: stage entries name their file and hold no rules, inputs or top-level descriptions`, () => {
    for (const [actor, entry] of Object.entries(raw.meta.actors)) {
      assert.ok(!('rules' in entry), `${w} ${actor} has rules`);
      assert.ok(!('inputs' in entry), `${w} ${actor} has inputs`);
      for (const [p, s] of Object.entries(entry.properties ?? {})) assert.ok(!('description' in (s ?? {})), `${w} ${actor}.${p} has a description`);
      if (STAGES[w].includes(actor)) assert.equal(entry.prompt, `${w}/${actor}.md`, `${w} ${actor} prompt`);
      else assert.ok(!('prompt' in entry), `${w} ${actor} is not a model stage`);
    }
    // The schemas are otherwise untouched: the base entry minus rules, inputs and top-level descriptions.
    for (const actor of STAGES[w]) {
      const { rules, inputs, ...b } = base.meta.actors[actor];
      if (b.properties) b.properties = Object.fromEntries(Object.entries(b.properties).map(([p, { description, ...s }]) => [p, s]));
      const { prompt, ...h } = raw.meta.actors[actor];
      assert.deepEqual(h, b, `${w} ${actor} schema`);
    }
  });

  test(`${w}.json: no invoke holds a task literal`, () => {
    for (const inv of allInvokes(raw)) {
      const t = inv.input?.task;
      assert.ok(!(t && typeof t === 'object' && 'value' in t), `${w} invoke ${inv.id} has a task literal`);
      if (t && typeof t === 'object') assert.deepEqual(t, { prompt: 'task' }, `${w} invoke ${inv.id}`);
    }
  });

  for (const actor of STAGES[w]) {
    test(`${w}/${actor}.md holds exactly the base JSON's words for ${actor}`, () => {
      const file = join(REPO, 'workflows', w, `${actor}.md`);
      assert.ok(existsSync(file), file);
      const f = sectionsOf(readFileSync(file, 'utf8'));
      assert.equal(f.title, `# ${actor}`);
      const b = base.meta.actors[actor];
      const binv = invokeOf({ ...base }, actor);
      const task = binv?.input?.task;
      const hasTask = task && typeof task === 'object' && 'value' in task;
      assert.deepEqual(f.order, hasTask ? ['Rules', 'Inputs', 'Output', 'Task'] : ['Rules', 'Inputs', 'Output'], 'sections');
      assert.deepEqual(items(f.sections.Rules), b.rules.map((r) => `- ${r}`), 'rules, in order');
      assert.deepEqual(items(f.sections.Inputs), Object.entries(b.inputs).map(([k, v]) => `- ${k}: ${v}`), 'input meanings, in order');
      const described = Object.entries(b.properties ?? {}).filter(([, s]) => s && 'description' in s).map(([p, s]) => `- ${p}: ${s.description}`);
      assert.ok(described.length >= 1, 'the base described some outputs');
      assert.deepEqual(items(f.sections.Output), described, 'output descriptions, schema order');
      if (hasTask) assert.equal(f.sections.Task.join('\n').trim(), task.value, 'task');
    });
  }
}

test('the three brief stages are the ones with a task, and no other .md sits in the stage folders', () => {
  const withTask = [];
  for (const w of WORKFLOWS) {
    const mds = readdirSync(join(REPO, 'workflows', w)).sort();
    assert.deepEqual(mds, STAGES[w].map((s) => `${s}.md`).sort(), w);
    for (const s of STAGES[w]) if (/^## Task$/m.test(readFileSync(join(REPO, 'workflows', w, `${s}.md`), 'utf8'))) withTask.push(`${w}/${s}`);
  }
  assert.deepEqual(withTask, ['quick-fix/brief', 'research/brief', 'feature/brief']);
});

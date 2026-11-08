// Stage files (why: plan/decisions/2026-11-05-stage-prompt-files-ready.md): a model stage's
// prose lives in one markdown file beside its workflow, workflows/<workflow>/<stage>.md, which its meta.actors entry
// names by path ("prompt": "quick-fix/build.md", relative to the workflow folder). The JSON keeps the wiring and the
// output schema; the file holds the words:
//
//   # <stage>
//
//   ## Rules
//   - <one rule per line>
//
//   ## Inputs
//   - <input>: <its meaning, one line>
//
//   ## Output
//   - <output field>: <its description, one line, in the schema's property order>
//
//   ## Task
//   <the fixed task, as written, for a stage whose invoke wires { "task": { "prompt": "task" } }>
//
// compose() fills the words back into the spec the engine has always run on (rules, inputs, property descriptions,
// task literals), so render(), the chart, the checks and replay are unchanged and every prompt stays byte for byte the
// same. It adds meta.prompts: each filled JSON pointer -> { file, line }, the file named from the repository root
// (workflows/...). The pin hashes the composed spec's bytes (pinBytes), so a blob alone replays an item. A workflow
// that names no stage file, its words inline in the JSON, is pinned as its own file bytes.
//
// The parser is strict: anything it would not put in the prompt is refused, naming the file and line, so no text can
// drop out of a prompt silently.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { esc } from './stages.js';

/** The key of a meta.actors entry that names its stage file. */
export const PROMPT = 'prompt';
/** The invoke input source { prompt: 'task' }: the Task section of the invoked stage's file. */
const TASK_SOURCE = 'task';
/** The folder a workflow's files are named from in a record: the repository's workflow folder. */
const FOLDER = 'workflows';
const SECTIONS = Object.freeze(['Rules', 'Inputs', 'Output', 'Task']);

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);

/** True when a raw workflow names at least one stage file: it must be composed before it runs. */
export const hasStageFiles = (raw) => Object.values(raw?.meta?.actors ?? {}).some((a) => isObject(a) && PROMPT in a);

/**
 * A stage file's text as { rules, inputs, output, task }: rules a list of { text, line }, inputs and output lists of
 * { name, text, line }, task { text, line } or null. `file` names it in errors. Throws on anything else in the file.
 */
export function parseStageFile(text, { file, stage }) {
  const lines = text.split('\n');
  const bad = (n, what) => { throw new Error(`${file}:${n}: ${what}`); };
  const out = { rules: [], inputs: [], output: [], task: null, headings: {}, end: lines.length };
  let section = null;
  let titled = false;
  const seen = [];
  let task = null;
  lines.forEach((raw, i) => {
    const n = i + 1;
    const line = raw.replace(/\r$/, '');
    if (!titled) {
      if (line.trim() === '') return;
      if (line !== `# ${stage}`) bad(n, `the file must start with the title line "# ${stage}"`);
      titled = true;
      return;
    }
    const heading = line.match(/^#{1,6}\s*(.*)$/);
    if (heading) {
      const name = line.startsWith('## ') ? line.slice(3) : null;
      if (!SECTIONS.includes(name)) bad(n, `unknown heading "${line}": a stage file has only ## ${SECTIONS.join(', ## ')}`);
      if (seen.includes(name)) bad(n, `## ${name} appears twice`);
      if (seen.length && SECTIONS.indexOf(name) < SECTIONS.indexOf(seen.at(-1))) bad(n, `## ${name} is out of order: the sections go ${SECTIONS.join(', ')}`);
      seen.push(name);
      out.headings[name] = n;
      section = name;
      if (name === 'Task') task = { lines: [], line: null };
      return;
    }
    if (section === 'Task') {
      if (task.line == null && line.trim() === '') return;
      task.line ??= n;
      task.lines.push(line);
      return;
    }
    if (line.trim() === '') return;
    if (section == null) bad(n, 'text outside a section: put it under ## Rules, ## Inputs, ## Output or ## Task');
    if (!line.startsWith('- ')) bad(n, `a ${section} item is one line starting "- "${line.startsWith(' ') ? ': an item cannot wrap onto a second line' : ''}`);
    const body = line.slice(2);
    if (body.trim() === '') bad(n, `an empty ${section} item`);
    if (section === 'Rules') {
      out.rules.push({ text: body, line: n });
      return;
    }
    const m = body.match(/^([^\s:]+): (.*)$/);
    if (!m || m[2].trim() === '') bad(n, `a ${section} item is "- <name>: <text>"`);
    const list = section === 'Inputs' ? out.inputs : out.output;
    if (list.some((x) => x.name === m[1])) bad(n, `${m[1]} is named twice under ## ${section}`);
    list.push({ name: m[1], text: m[2], line: n });
  });
  if (!titled) bad(1, `the file is empty: it must start with "# ${stage}"`);
  for (const s of ['Rules', 'Inputs']) if (!seen.includes(s)) bad(lines.length, `no ## ${s} section`);
  if (!out.rules.length) bad(lines.length, 'no rules under ## Rules');
  if (task) {
    while (task.lines.length && task.lines.at(-1).trim() === '') task.lines.pop();
    if (!task.lines.length) bad(lines.length, '## Task is empty');
    out.task = { text: task.lines.join('\n'), line: task.line };
  }
  return out;
}

// Every invoke of the chart with its JSON pointer, as chart() in stages.js walks it.
const invokesOf = (spec) => {
  const found = [];
  const walk = (node, at) => {
    for (const [name, st] of Object.entries(node?.states ?? {})) {
      const here = `${at}/states/${esc(name)}`;
      const list = st.invoke == null ? [] : Array.isArray(st.invoke) ? st.invoke.map((v, i) => [v, `${here}/invoke/${i}`]) : [[st.invoke, `${here}/invoke`]];
      for (const [inv, iat] of list) found.push({ inv, at: iat });
      walk(st, here);
    }
  };
  walk(spec, '');
  return found;
};

/**
 * The spec a raw workflow runs on: every stage file named in meta.actors read from `dir` (the workflow folder) and
 * filled in, with meta.prompts mapping each filled pointer to { file, line }. A workflow naming no stage file is
 * returned as it is. `name` is the workflow's name, for errors.
 */
export function compose(raw, { dir, name = raw?.id ?? 'workflow' }) {
  if (!hasStageFiles(raw)) return raw;
  const spec = structuredClone(raw);
  const where = {};
  const tasks = {};
  for (const [actor, entry] of Object.entries(spec.meta.actors)) {
    if (!isObject(entry) || !(PROMPT in entry)) continue;
    const { [PROMPT]: rel, ...schema } = entry;
    const file = `${FOLDER}/${rel}`;
    const bad = (what) => { throw new Error(`${name}: stage ${actor}: ${what}`); };
    if (typeof rel !== 'string' || !/^[\w.-]+(\/[\w.-]+)*\.md$/.test(rel) || rel.split('/').includes('..')) bad(`prompt must be a .md path inside the workflow folder, not ${JSON.stringify(rel)}`);
    for (const k of ['rules', 'inputs']) if (k in schema) bad(`names its stage file ${file} and also has ${k} in the JSON: the words live in the file only`);
    for (const [p, s] of Object.entries(schema.properties ?? {})) if (isObject(s) && 'description' in s) bad(`names its stage file ${file} and also describes output ${p} in the JSON: the words live in the file only`);
    let text;
    try {
      text = readFileSync(join(dir, rel), 'utf8');
    } catch (error) {
      bad(`cannot read its stage file ${file}: ${error.code ?? error.message}`);
    }
    const parsed = parseStageFile(text, { file, stage: actor });
    const at = (n, what) => { throw new Error(`${file}:${n}: ${what}`); };
    const base = `/meta/actors/${esc(actor)}`;
    const props = Object.keys(schema.properties ?? {});
    // Every output property is described, so no description drops out of the prompt with a deleted line or section.
    if (props.length && parsed.headings.Output == null) at(parsed.end, `no ## Output section: ${actor}'s output has ${props.join(', ')}, each needs a line`);
    // The Inputs are exactly the inputs every invoke of this stage gives it, checked here so the error names the line.
    for (const { inv, at: iat } of invokesOf(spec).filter((x) => x.inv.src === actor)) {
      const given = Object.keys(inv.input ?? {});
      for (const x of parsed.inputs) if (!given.includes(x.name)) at(x.line, `${x.name} is not an input of ${actor}: invoke ${inv.id ?? actor} (at ${iat}) gives ${given.join(', ')}`);
      const missing = given.filter((k) => !parsed.inputs.some((x) => x.name === k));
      if (missing.length) at(parsed.headings.Inputs, `## Inputs lacks ${missing.join(', ')}: invoke ${inv.id ?? actor} (at ${iat}) gives it, and every input needs its meaning`);
    }
    let last = -1;
    for (const o of parsed.output) {
      const i = props.indexOf(o.name);
      if (i < 0) at(o.line, `${o.name} is not an output property of ${actor} (its properties: ${props.join(', ') || 'none'})`);
      if (i < last) at(o.line, `${o.name} is out of order: ## Output follows the schema's property order (${props.join(', ')})`);
      last = i;
    }
    const undescribed = props.filter((p) => !parsed.output.some((o) => o.name === p));
    if (undescribed.length) at(parsed.headings.Output, `## Output lacks ${undescribed.join(', ')}: every output property of ${actor} needs a line`);
    parsed.rules.forEach((r, i) => { where[`${base}/rules/${i}`] = { file, line: r.line }; });
    for (const x of parsed.inputs) where[`${base}/inputs/${esc(x.name)}`] = { file, line: x.line };
    const described = Object.fromEntries(parsed.output.map((o) => [o.name, o]));
    for (const o of parsed.output) where[`${base}/properties/${esc(o.name)}/description`] = { file, line: o.line };
    spec.meta.actors[actor] = {
      rules: parsed.rules.map((r) => r.text),
      inputs: Object.fromEntries(parsed.inputs.map((x) => [x.name, x.text])),
      ...schema,
      ...(schema.properties
        ? { properties: Object.fromEntries(Object.entries(schema.properties).map(([p, s]) => [p, described[p] ? { ...s, description: described[p].text } : s])) }
        : {})
    };
    tasks[actor] = { ...parsed.task, file, end: parsed.end, used: false };
  }
  // The fixed tasks: an invoke input { prompt: 'task' } takes the Task section of its stage's file.
  for (const { inv, at } of invokesOf(spec)) {
    for (const [k, source] of Object.entries(inv.input ?? {})) {
      if (!isObject(source) || !(PROMPT in source)) continue;
      const bad = (what) => { throw new Error(`${name}: invoke ${inv.id ?? inv.src} (at ${at}) input ${k}: ${what}`); };
      if (k !== TASK_SOURCE || source[PROMPT] !== TASK_SOURCE || Object.keys(source).length !== 1) bad(`{ "prompt": "task" } is the only prompt source, and only for input task`);
      const t = tasks[inv.src];
      if (!t) bad(`${inv.src} names no stage file to take its task from`);
      if (t.text == null) throw new Error(`${t.file}:${t.end}: no ## Task section, but invoke ${inv.id ?? inv.src} (at ${at}) wires its task from it`);
      inv.input[k] = { value: t.text };
      where[`${at}/input/${esc(k)}/value`] = { file: t.file, line: t.line };
      t.used = true;
    }
  }
  for (const t of Object.values(tasks)) if (t.text != null && !t.used) throw new Error(`${t.file}:${t.line}: ## Task, but no invoke wires { "task": { "prompt": "task" } } to this stage`);
  spec.meta.prompts = where;
  return spec;
}

/** The bytes a composed spec is pinned and stored as. */
export const pinBytes = (spec) => Buffer.from(`${JSON.stringify(spec, null, 2)}\n`, 'utf8');

/**
 * A workflow file and its stage files as { raw, spec, bytes }: raw the file as parsed, spec what the engine runs on,
 * and bytes what the pin hashes and the blob stores (the file's own bytes when it names no stage file).
 */
export function readWorkflow(name, { dir }) {
  const file = readFileSync(join(dir, `${name}.json`));
  const raw = JSON.parse(file.toString('utf8'));
  if (!hasStageFiles(raw)) return { raw, spec: raw, bytes: file };
  const spec = compose(raw, { dir, name });
  return { raw, spec, bytes: pinBytes(spec) };
}

/** Where a JSON pointer's text came from in a stage file, { file, line }, or null. */
export const locationOf = (spec, pointer) => (pointer != null && spec?.meta?.prompts?.[pointer]) || null;

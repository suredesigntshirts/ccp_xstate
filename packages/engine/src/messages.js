// The message catalogue (plan item prompt-catalogue): every text the engine or the harness plugin hands a model,
// outside the stage files, is a named entry of packages/engine/messages.md, rendered here. The code picks an entry and
// gives its slot values; it writes no wording of its own. Why and how: plan/decisions/2026-11-06-prompt-catalogue.md.
//
// The file: a preamble, then entries. An entry is a `## <name>` heading (kebab-case), optional note lines saying when
// it is sent, and its template in a ``` fence, byte for byte (the fence keeps leading `## ` and blank lines in a
// template apart from the headings). Slots are `{{name}}` and nothing else.
//
// Rendering is mustache.js (packages/engine/src/vendor/mustache.mjs, the npm package's mustache.mjs copied verbatim;
// the installed plugin has no node_modules, so the copy rides along with the engine source) behind a strict wrapper:
// a template may hold only text and plain {{name}} tags, a render must give exactly the template's slots, each a
// string or a finite number, and nothing is HTML-escaped.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import Mustache from './vendor/mustache.mjs';

/** The catalogue beside this package's src folder: packages/engine/messages.md, lib/engine/messages.md when bundled. */
export const CATALOGUE = fileURLToPath(new URL('../messages.md', import.meta.url));

const NAME = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/;
const SLOT = /^[a-z][A-Za-z0-9]*$/;
const FENCE = '```';
const KIND = { '#': 'a section', '^': 'an inverted section', '/': 'a section end', '>': 'a partial', '!': 'a comment', '=': 'a delimiter change', '&': 'an unescaped variable' };

// The slots of a template, in order of first use, or a throw naming the entry and the line of the first tag that is
// not a plain {{name}} slot.
function slotsOf(template, name, where) {
  let tokens;
  try {
    tokens = Mustache.parse(template);
  } catch (error) {
    throw new Error(`${where}: entry ${name}: ${error.message}`);
  }
  const lineOf = (at) => where.replace(/:(\d+)$/, (_, n) => `:${Number(n) + template.slice(0, at).split('\n').length - 1}`);
  const slots = [];
  for (const [type, value, start] of tokens) {
    if (type === 'text') continue;
    if (type !== 'name') throw new Error(`${lineOf(start)}: entry ${name} uses ${KIND[type] ?? `a ${type} tag`} ({{${type}${value}}}); only {{name}} slots are allowed`);
    if (!SLOT.test(value)) throw new Error(`${lineOf(start)}: entry ${name} has slot {{${value}}}; a slot is a plain name (letters and digits, starting lower case)`);
    if (!slots.includes(value)) slots.push(value);
  }
  return slots;
}

/**
 * The entries of a catalogue's text: Map name -> { name, template, slots, note, line }, line the heading's. Throws,
 * naming the file and line, on a heading that is not kebab-case, a duplicate name, an entry with no fenced template or
 * an empty one, an unclosed fence, text between entries, or a template with any tag but a plain slot.
 */
export function parse(text, file = 'messages.md') {
  const lines = String(text).split('\n');
  const entries = new Map();
  const bad = (n, what) => { throw new Error(`${file}:${n}: ${what}`); };
  let i = lines.findIndex((l) => l.startsWith('## '));
  if (i === -1) return entries;
  while (i < lines.length) {
    if (lines[i].trim() === '') { i++; continue; }
    if (!lines[i].startsWith('## ')) bad(i + 1, 'text outside an entry: each entry is a "## <name>" heading, note lines, then its template in a ``` fence');
    const at = i + 1;
    const name = lines[i].slice(3);
    if (!NAME.test(name)) bad(at, `entry name ${JSON.stringify(name)} is not kebab-case`);
    if (entries.has(name)) bad(at, `entry ${name} is a duplicate of line ${entries.get(name).line}`);
    const note = [];
    for (i++; i < lines.length && lines[i] !== FENCE; i++) {
      if (lines[i].startsWith('## ') || lines[i].startsWith(FENCE)) bad(i + 1, `entry ${name} has no template: its note lines end at a line that is exactly ${FENCE}`);
      note.push(lines[i]);
    }
    if (i === lines.length) bad(at, `entry ${name} has no template`);
    const open = i + 1;
    const body = [];
    for (i++; i < lines.length && lines[i] !== FENCE; i++) body.push(lines[i]);
    if (i === lines.length) bad(open, `entry ${name}'s template is not closed with a line that is exactly ${FENCE}`);
    i++;
    const template = body.join('\n');
    if (template.trim() === '') bad(open, `entry ${name} is empty`);
    const slots = slotsOf(template, name, `${file}:${open + 1}`);
    entries.set(name, { name, template, slots, note: note.join('\n').trim(), line: at });
  }
  return entries;
}

/**
 * A catalogue from its text: { entries, render, said }. render(name, values) is the entry's text, said(name, values)
 * the same as { text, message: { entry, slots } }, what a journal row records beside the text. A render is refused,
 * naming the entry, for an unknown entry, a slot with no value, a value no slot names, or a value that is not a
 * string or a finite number.
 */
export function catalogue(text, file = 'messages.md') {
  const entries = parse(text, file);
  const render = (name, values = {}) => {
    const e = entries.get(name);
    if (!e) throw new Error(`no message entry ${JSON.stringify(name)} in ${file}`);
    const given = Object.keys(values ?? {});
    const missing = e.slots.filter((s) => !given.includes(s));
    if (missing.length) throw new Error(`message ${name}: no value for ${missing.map((s) => `{{${s}}}`).join(', ')}`);
    const extra = given.filter((k) => !e.slots.includes(k));
    if (extra.length) throw new Error(`message ${name}: no slot for ${extra.join(', ')}`);
    for (const k of given) {
      const v = values[k];
      if (!(typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v)))) throw new Error(`message ${name}: {{${k}}} is ${v === null ? 'null' : Array.isArray(v) ? 'an array' : typeof v}, not text or a number`);
    }
    return Mustache.render(e.template, values, {}, { escape: String });
  };
  const said = (name, values = {}) => ({ text: render(name, values), message: { entry: name, slots: { ...values } } });
  return { entries, render, said };
}

/** Loads a catalogue file. */
export const load = (file = CATALOGUE) => catalogue(readFileSync(file, 'utf8'), file);

let shared = null;
const messages = () => (shared ??= load());
/** The entries of the harness's own catalogue. */
export const entries = () => messages().entries;
/** An entry of the harness's own catalogue, rendered (see catalogue). */
export const render = (name, values) => messages().render(name, values);
/** An entry of the harness's own catalogue, rendered, with what to record: { text, message: { entry, slots } }. */
export const said = (name, values) => messages().said(name, values);

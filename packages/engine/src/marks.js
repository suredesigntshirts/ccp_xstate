// The stage contract's marks: what a workflow declares about each model stage's output, so the engine reads the
// workflow's rules instead of guessing them. They sit in the workflow's meta.marks, one entry per model stage:
//   "<stage>": {
//     "verdicts": { "<path>": "<value>" }   a verdict field, and the value that means the check passed; on a covered
//                                           list's entries' result ("<list>.0.result"), which entries pass;
//     "briefs":   ["<field>", ...]          top-level text fields whose values are the briefs of the roles they are
//                                           named for, stored when the result is accepted (brief.stored);
//     "refs":     { "<path>": "<kind>" }    the refs { url, at } the output holds, and the kind of each, whose
//                                           checker (refs/) the host runs before the result counts.
//   }
// A path is the output field's names joined by dots, `0` standing for any entry of a list. The output schema itself
// is untouched, so the prompt, which prints it, reads as before.
//
// A stage with no entry in meta.marks (every stage of a workflow pinned before marks) is read as the engine read it
// then (inferred), so items pinned to such a workflow, and runs prepared from one, keep their rules. That reading is
// the only place the engine looks at a stage's name or at the words PASS and FAIL.
import { prRef } from './effects/merge.js';

/** The parts a stage's marks may have. */
export const PARTS = Object.freeze(['verdicts', 'briefs', 'refs']);

const isObject = (v) => v != null && typeof v === 'object' && !Array.isArray(v);
const deref = (s, defs) => {
  for (let i = 0; isObject(s) && s.$ref && i < 16; i++) s = defs?.[s.$ref.slice(1)];
  return s;
};
const words = (s) => [...(Array.isArray(s?.enum) ? s.enum : []), ...(isObject(s) && 'const' in s ? [s.const] : [])];
/** A path as marks name it: the names joined by dots, any list index as 0. */
export const pathOf = (segs) => segs.map((s) => (/^\d+$/.test(String(s)) ? '0' : String(s))).join('.');

/**
 * Every node of an output schema with its path as a list of names ($refs resolved; `0` for a list's entries),
 * depth-first in property order, then list entries, then (unless alternatives is false) the fields of each oneOf
 * alternative.
 */
export function nodesOf(schema, defs, { alternatives = true } = {}, path = [], depth = 0, out = []) {
  const s = deref(schema, defs);
  if (!isObject(s) || depth > 8) return out;
  out.push({ node: s, path });
  const opts = { alternatives };
  for (const [k, x] of Object.entries(isObject(s.properties) ? s.properties : {})) nodesOf(x, defs, opts, [...path, k], depth + 1, out);
  if (isObject(s.items)) nodesOf(s.items, defs, opts, [...path, '0'], depth + 1, out);
  for (const alt of alternatives && Array.isArray(s.oneOf) ? s.oneOf : []) {
    for (const n of nodesOf(alt, defs, opts, path, depth + 1)) if (n.path.length) out.push(n);
  }
  return out;
}

/** The node at a path (a list of names) below a schema, $refs resolved, or undefined. */
export const nodeAt = (schema, defs, segs) => {
  let s = deref(schema, defs);
  for (const seg of segs) {
    if (!isObject(s)) return undefined;
    s = deref(isObject(s.properties) && Object.hasOwn(s.properties, seg) ? s.properties[seg] : /^\d+$/.test(seg) ? s.items : undefined, defs);
  }
  return isObject(s) ? s : undefined;
};

/** Whether a schema node is a ref { url, at }. */
export const isRef = (s) => isObject(s?.properties) && isObject(s.properties.url) && isObject(s.properties.at);

// ---- Read from marks

const declared = (stage, marks) => {
  const verdicts = isObject(marks.verdicts) ? marks.verdicts : {};
  const briefs = Array.isArray(marks.briefs) ? marks.briefs : [];
  const refs = isObject(marks.refs) ? marks.refs : {};
  const top = Object.keys(verdicts).filter((p) => !p.includes('.'));
  return {
    inferred: false,
    verdictAt: () => (Object.keys(verdicts).length ? Object.keys(verdicts)[0].split('.') : null),
    isVerdict: (segs) => segs.length === 1 && top.includes(String(segs[0])),
    passes: (field, value) => Object.hasOwn(verdicts, `${field}.0.result`) && value === verdicts[`${field}.0.result`],
    verdicts: (result) => top.filter((k) => result?.[k] !== undefined).map((k) => [k, result[k] === verdicts[k]]),
    briefs: (result) => Object.entries(result ?? {}).filter(([k, v]) => typeof v === 'string' && briefs.includes(k)),
    kindOf: (segs) => refs[pathOf(segs)] ?? null
  };
};

// ---- Inferred, for a stage without marks: the reading before marks

/** The verdict words the engine read before marks, in any case. */
const WORD = /^(pass|fail)$/i;
const isWord = (s) => words(s).length > 0 && words(s).every((v) => typeof v === 'string' && WORD.test(v));
const pass = (v) => String(v).toUpperCase() === 'PASS';

const inferred = (actor, stage, defs) => ({
  inferred: true,
  // The first output field, at any depth, that may say the word PASS or FAIL (any case).
  verdictAt: () => nodesOf(stage, defs, { alternatives: false }).find(({ node, path }) => path.length && words(node).some((v) => typeof v === 'string' && WORD.test(v)))?.path ?? null,
  // A top-level field every value of which is the word PASS or FAIL.
  isVerdict: (segs) => segs.length === 1 && isWord(nodeAt(stage, defs, segs)),
  passes: (field, value) => pass(value),
  // Any top-level value that is the word PASS or FAIL.
  verdicts: (result) => Object.entries(result ?? {}).filter(([, v]) => typeof v === 'string' && WORD.test(v)).map(([k, v]) => [k, pass(v)]),
  // The stage named brief: each text field of its result.
  briefs: (result) => (actor === 'brief' ? Object.entries(result ?? {}).filter(([, v]) => typeof v === 'string') : []),
  // A ref to a GitHub PR is a PR; any other is a web page.
  kindOf: (segs, ref) => (prRef(ref?.url) ? 'github-pr' : 'web-page')
});

/**
 * What a stage's output declares, as the engine reads it: { inferred, verdictAt(), isVerdict(segs), passes(field, value),
 * verdicts(result), briefs(result), kindOf(segs, ref) }.
 * - verdictAt: the path of a verdict field, as a list of names, or null;
 * - isVerdict: whether segs name a top-level verdict field;
 * - passes: whether a covered entry's result value, in the list `field`, means its line passed;
 * - verdicts: [key, passed] for each top-level verdict field the result sets;
 * - briefs: [role, text] for each brief the result carries, in the result's order;
 * - kindOf: the ref kind of the ref at segs of the result, or null when it is no declared ref.
 * From `marks`, the stage's meta.marks entry; without one, inferred as before marks (`actor` is the stage's name).
 */
export const marksOf = (actor, stage, defs = {}, marks = undefined) => (isObject(marks) ? declared(stage, marks) : inferred(actor, stage, defs));

/** A spec's marks for one stage: its meta.marks entry, or undefined. */
export const marksIn = (spec, actor) => (isObject(spec?.meta?.marks) && isObject(spec.meta.marks[actor]) ? spec.meta.marks[actor] : undefined);

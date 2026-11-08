// The engine's account of one event: which transitions it tried, in its own order, and which of their tests failed.
// Readers (the Workflow Inspector) show this instead of working it out from the workflow file themselves.
import { chart } from './stages.js';
import { failingOf, testsOf } from './spec.js';

// The active state paths of a snapshot value: "a" -> ["a"], { a: "b" } -> ["a.b"].
const leaves = (value, prefix = '') => {
  if (value == null) return [];
  if (typeof value === 'string') return [prefix ? `${prefix}.${value}` : value];
  return Object.entries(value).flatMap(([k, v]) => leaves(v, prefix ? `${prefix}.${k}` : k));
};

// A state path and its ancestors, the deepest first: "a.b" -> ["a.b", "a"].
const upward = (key) => key.split('.').map((_, i, parts) => parts.slice(0, parts.length - i).join('.'));

// Does transition t answer an event of this type? An outside event by its name; an invoke's result or error by
// XState's done and error event for that invoke's id; a timer by XState's after event for that delay and state.
const answers = (t, type) => {
  if (t.event != null) return t.event === type;
  if (t.on === 'done') return type === `xstate.done.actor.${t.invoke}`;
  if (t.on === 'error') return type === `xstate.error.actor.${t.invoke}`;
  if (t.delay != null) return type.startsWith(`xstate.after.${t.delay}.`) && type.endsWith(`.${t.state}`);
  return false;
};

/**
 * What the engine does with event in snapshot (an XState snapshot of spec's machine, or anything with its value and
 * context): { tried, taken }. tried lists, in the order the engine tries them, every transition that answers the event
 * from an active state or an ancestor of one (the deepest state first, each state's transitions in file order), up to
 * the first whose tests all hold: [{ at, state, after, stays, guard, needs, tests, failing, taken, description }].
 * at is the transition's JSON pointer in the workflow file, after the state it enters (its own state when it stays),
 * needs the needs of that state, tests its guard then those needs, and failing the tests that fail on the context as
 * its actions leave it (spec.js failingOf, the same check its bound guard makes). taken is the at of the transition
 * taken, or null when the event changes nothing.
 */
export function explain(spec, snapshot, event) {
  const { transitions, nodes } = chart(spec);
  const type = String(event?.type ?? '');
  const scope = { context: snapshot?.context ?? {}, event };
  const tried = [];
  const seen = new Set();
  for (const leaf of leaves(snapshot?.value)) {
    for (const state of upward(leaf)) {
      if (seen.has(state)) continue;
      seen.add(state);
      for (const t of transitions.filter((x) => x.state === state && answers(x, type))) {
        const target = nodes.get(t.after);
        const needs = target?.meta?.needs ?? [];
        const failing = failingOf(spec, t.def, target, scope);
        const taken = failing.length === 0;
        tried.push({
          at: t.at, state: t.state, after: t.after, stays: !t.def.target, guard: t.guard, needs,
          tests: testsOf(t.def, target), failing, taken, description: t.def.description ?? null
        });
        if (taken) return { tried, taken: t.at };
      }
    }
  }
  return { tried, taken: null };
}

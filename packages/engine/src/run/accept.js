// Accepting a run's result: the one way a result counts. The caller must be the run's agent, the run must still be
// bound, the result must match the actor's schema, restate its inputs as they were, cover what it must, and every PR
// it claims must be on GitHub at the claimed head. A refused result spends one of the run's refused attempts
// (run/store.js BUDGET); the one that spends the last fails the run.
import { check } from '../schema.js';
import { prRef } from '../effects/merge.js';
import { render, said } from '../messages.js';
import { blockedOf, coverGap, STAMPED } from '../stages.js';
import { resultHash, sha256 } from '../names.js';
import { headOf } from './worktree.js';
import { answerOf, BUDGET, bindingOf, journal, loadRun, RESULT_RULES, resultRefusals, spend, state, storeBlob, transition } from './store.js';

export { RESULT_RULES };

const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

/**
 * Whether a restated value agrees with the input it restates: an object may leave out keys,
 * and every key it carries must agree with the input's, at any depth; arrays and other values must be equal. The
 * schema's required list says what must be carried. Key order does not matter.
 */
export function agrees(given, input) {
  if (plain(given) && plain(input)) {
    return Object.keys(given).every((k) => Object.hasOwn(input, k) && agrees(given[k], input[k]));
  }
  if (Array.isArray(given) && Array.isArray(input)) {
    return given.length === input.length && given.every((v, i) => agrees(v, input[i]) && agrees(input[i], v));
  }
  return JSON.stringify(given) === JSON.stringify(input);
}

// A value as a refusal shows it: JSON, cut to CUT characters.
const CUT = 200;
const cut = (v) => {
  const t = JSON.stringify(v) ?? 'undefined';
  return t.length > CUT ? `${t.slice(0, CUT)}…` : t;
};

/**
 * Where a restated value disagrees with its input, as agrees() decides it: every differing path, with the returned
 * value and the input's. A key the input lacks is named as not in the input; arrays of different
 * length are named whole.
 */
export function differences(given, input, path, inPath) {
  if (plain(given) && plain(input)) {
    return Object.keys(given).flatMap((k) =>
      Object.hasOwn(input, k) ? differences(given[k], input[k], `${path}.${k}`, `${inPath}.${k}`) : [render('difference-not-in-input', { path: `${path}.${k}`, inPath: String(inPath) })]
    );
  }
  if (Array.isArray(given) && Array.isArray(input) && given.length === input.length) {
    return given.flatMap((v, i) => differences(v, input[i], `${path}[${i}]`, `${inPath}[${i}]`));
  }
  if (agrees(given, input)) return [];
  return [render('difference', { path: String(path), given: cut(given), inPath: String(inPath), input: cut(input) })];
}

/** The result refusals a run may have; the last one fails it. */
export const REFUSAL_CAP = BUDGET.refused;

// How to fix a refusal: `<field>: <description>` for each top-level output field the reason names, once each, in the
// schema's order. Only top-level fields carry descriptions (prompts.js puts each ## Output line there).
// The journal keeps each as `<field>: <description>`; the deny shows each as a refusal-hint line (refusalText).
function hintOf(schema, reason) {
  const named = new Set([...String(reason).matchAll(/\bresult\.([A-Za-z_$][\w$]*)/g)].map((m) => m[1]));
  return Object.entries(schema?.properties ?? {})
    .filter(([k, s]) => named.has(k) && typeof s?.description === 'string' && s.description.trim())
    .map(([k, s]) => `${k}: ${s.description}`);
}

/**
 * The checks a result passes before it counts, in order: the run exists, the caller is the agent the run started,
 * the run hasn't returned yet, the result matches the actor's schema, and every PR it claims is on GitHub at the
 * claimed head. `github` is a client from effects/github.js ({ pull }). Returns { accepted: { run, hash } } or
 * { refused: { rule, reason } }; both are journalled in the item's file. A refusal of the result (RESULT_RULES) also
 * has fix: { hint, count, cap }, and the one that reaches REFUSAL_CAP has failed: the run, which has then failed.
 */
export async function accept({ root, caller, run: runId, result, toolUseId, github, web = null, session = null }) {
  const run = loadRun(root, runId);
  if (!run) return { refused: { rule: 'unknown-run', reason: render('accept-unknown-run', { run: JSON.stringify(runId ?? null) }) } };
  // A refusal of the result (RESULT_RULES) carries how to fix it and counts toward the run's cap; the one that reaches
  // the cap fails the run, so its item takes the invoke's error instead of the agent looping.
  // `told` is a catalogue render with what to record (messages.js said): the row keeps its entry and slot values.
  const refuse = (rule, told) => {
    const { text: reason, message } = told;
    const counted = RESULT_RULES.includes(rule);
    const extra = counted ? { hint: hintOf(run.schema, reason), count: spend(root, run, 'refused'), cap: REFUSAL_CAP } : {};
    journal(root, run, {
      kind: 'refusal',
      source: { system: 'hook', ref: toolUseId ?? `return ${run.run}` },
      agent: caller ?? null,
      payload: { source: 'hook', rule, reason, message, ...extra, run: run.run, actor: run.actor, caller: caller ?? null, tool: 'harness return', textHash: sha256(`${rule}: ${reason}`), outcome: 'denied', hookSession: session }
    });
    const fix = counted ? { fix: extra } : {};
    if (!counted || extra.count < REFUSAL_CAP) return { refused: { rule, reason }, ...fix };
    // The cap's reason lists every refusal the run had, from the journal, where each one's reason is kept.
    const list = resultRefusals(root, run).map((r) => r.payload).map((r, i) => render('refusal-cap-item', { n: i + 1, rule: String(r.rule), reason: String(r.reason) }));
    const capped = said('refusal-cap', { cap: REFUSAL_CAP, list: list.join(' ') });
    const why = capped.text;
    const failed = transition(root, run, 'fail', { agentId: caller ?? null, why, at: new Date().toISOString() }, {
      kind: 'refusal',
      source: { system: 'hook', ref: toolUseId ?? `return ${run.run}` },
      agent: caller ?? null,
      payload: { source: 'hook', rule: 'refusal-cap', reason: why, message: capped.message, run: run.run, actor: run.actor, caller: caller ?? null, tool: 'harness return', textHash: sha256(`refusal-cap: ${why}`), outcome: 'failed', hookSession: session }
    });
    if (!failed) return { refused: { rule, reason }, ...fix };
    return { refused: { rule, reason }, ...fix, failed: run.run };
  };

  const bound = bindingOf(root, run);
  if (!bound) return refuse('wrong-caller', said('wrong-caller-unbound', { run: run.run }));
  if (!caller) return refuse('wrong-caller', said('wrong-caller-main', { run: run.run, agent: String(bound.agentId) }));
  if (caller !== bound.agentId) return refuse('wrong-caller', said('wrong-caller-agent', { caller: String(caller), run: run.run, agent: String(bound.agentId) }));
  const now = state(root, run);
  const answer = answerOf('return', now, root, run);
  if (answer) return refuse(now === 'returned' ? 'already-returned' : 'already-failed', said(answer, answer === 'already-failed-refused' ? { run: run.run, cap: REFUSAL_CAP } : { run: run.run }));

  const problems = check(run.schema, result, run.defs);
  if (problems.length) return refuse('schema', said('schema', { actor: run.actor, problems: problems.join('; ').replaceAll('$', 'result') }));

  // A result is taken only when its refs are observed on GitHub, its restated inputs equal the inputs, and it sets no
  // stamped field. Only the stamped result is stored.
  const refs = refsIn(result);
  for (const { path, ref } of refs) {
    const taken = STAMPED.filter((k) => k in ref);
    if (taken.length) return refuse('reserved', said('reserved', { path, fields: taken.join(', ') }));
  }
  for (const k of Object.keys(result ?? {})) {
    if (run.input && Object.hasOwn(run.input, k) && !agrees(result[k], run.input[k])) {
      const where = differences(result[k], run.input[k], `result.${k}`, k).join('; ');
      return refuse('restated', said('restated', { field: k, differences: where }));
    }
  }
  // A blocked result (the stage's "could not") covers nothing: it becomes the stage's error (resultsOf).
  const gap = blockedOf(run.schema, result) == null ? coverGap(run.schema, run.input, result) : null;
  if (gap) return refuse('covers', gap);
  const stamped = structuredClone(result);
  for (const { path, ref } of refsIn(stamped)) {
    const pr = prRef(ref.url);
    if (pr) {
      let now;
      try {
        now = await github.pull(pr);
      } catch (error) {
        return refuse('ref', error.status === 404 ? said('ref-no-pr', { path, url: ref.url }) : said('ref-unreadable', { path, url: ref.url, error: String(error.message) }));
      }
      if (now?.head?.sha !== ref.at) return refuse('ref', said('ref-head', { path, url: ref.url, sha: String(now?.head?.sha ?? 'none'), at: ref.at }));
      const head = headOf(run.worktree);
      if (head !== ref.at) return refuse('ref', said('ref-worktree', { path, head, at: ref.at }));
      ref.key = `${pr.owner}/${pr.repo}#${pr.pullNumber}`;
      // The PR's branch, for a rebuild's worktree: only when the head is in the PR's own
      // repository, since a fork's branch is not on origin. GitHub gives head.repo null when the fork is gone.
      const from = now?.head?.repo;
      const own = from === undefined || (typeof from?.full_name === 'string' && from.full_name.toLowerCase() === `${pr.owner}/${pr.repo}`.toLowerCase());
      if (own && typeof now?.head?.ref === 'string' && now.head.ref) ref.branch = now.head.ref;
      // The exact commands that put this head in a worktree: host-filled data.
      ref.checkout = `git fetch origin pull/${pr.pullNumber}/head && git checkout --detach ${ref.at}`;
      // Fails closed: when the files cannot all be listed, the gates are unknown, and an
      // unknown gate is a touched gate, so the person's CI-change card is asked.
      let files = null;
      let unlisted = null;
      try {
        files = await github.files(pr);
      } catch (error) {
        unlisted = `GitHub could not list the PR's files (${error.message})`;
      }
      if (!unlisted && !Array.isArray(files)) unlisted = 'GitHub gave no file list';
      if (!unlisted && files.length >= FILES_PAGE) unlisted = `the PR has ${FILES_PAGE} or more files, more than one page`;
      const gates = unlisted
        ? [`(unknown: ${unlisted})`]
        : files.map((f) => f.filename).filter((f) => typeof f === 'string' && f.startsWith('.github/'));
      if (gates.length) ref.gates = gates;
      const suites = (await github.suites({ owner: pr.owner, repo: pr.repo, sha: ref.at }))?.check_suites ?? [];
      if (suites.length && suites.every((x) => x.status === 'completed' && GREEN.includes(x.conclusion))) ref.green = true;
    } else {
      let page = null;
      try {
        page = await web.get(ref.url);
      } catch (error) {
        page = { status: 0, body: String(error?.message ?? error) };
      }
      const flat = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
      if (!(page?.status >= 200 && page?.status <= 299) || !flat(page.body).includes(flat(ref.at))) {
        return refuse('ref', said('ref-page', { path, url: ref.url }));
      }
    }
  }

  const text = JSON.stringify(stamped);
  const { hash, bytes } = storeBlob(root, text);
  // sent is the result as the agent sent it, before the stamp: the return tool's server matches its call by it.
  const stored = transition(root, run, 'return', { result: stamped, hash, sent: resultHash(result), caller, toolUseId, at: new Date().toISOString() }, {
    kind: 'result.stored',
    source: { system: 'journal', ref: `blobs/${hash}` },
    agent: caller,
    payload: { run: run.run, actor: run.actor, agentId: caller, hash, bytes, toolUseId: toolUseId ?? null }
  });
  if (!stored) return refuse('already-returned', said('already-returned', { run: run.run }));
  // A brief actor's briefs are fixed here, before any build starts: the verifier later gets this text exactly.
  if (run.actor === 'brief') {
    for (const [role, brief] of Object.entries(result)) {
      if (typeof brief !== 'string') continue;
      const b = storeBlob(root, brief);
      journal(root, run, { kind: 'brief.stored', source: { system: 'journal', ref: `blobs/${b.hash}` }, payload: { run: run.run, actor: run.actor, role, hash: b.hash, bytes: b.bytes } });
    }
  }
  return { accepted: { run: run.run, hash } };
}

/**
 * The text an agent sees for a refused return: `<rule>: <reason>`, then for a result refusal how
 * to fix it, from the run's Output, and which refusal of the cap this is; at the cap, that the run has failed.
 */
export function refusalText({ refused, fix = null, failed = null }) {
  const said = { rule: String(refused.rule), reason: String(refused.reason) };
  if (!fix) return failed ? render('refusal-failed', { ...said, cap: REFUSAL_CAP, run: String(failed) }) : render('refusal', said);
  const counted = { ...said, count: fix.count, cap: fix.cap };
  // Each hint is `<field>: <description>` as the journal keeps it (hintOf).
  const hints = (fix.hint ?? []).map((h) => {
    const at = h.indexOf(': ');
    return render('refusal-hint', { field: h.slice(0, at), description: h.slice(at + 2) });
  }).join('\n');
  if (failed) return hints ? render('refusal-last-hints', { ...counted, hints, run: String(failed) }) : render('refusal-last', { ...counted, run: String(failed) });
  return hints ? render('refusal-counted-hints', { ...counted, hints }) : render('refusal-counted', counted);
}

// Every ref { url, at } in a value, depth-first, with its path. STAMPED (stages.js): the fields the
// host stamps on a PR ref.
const FILES_PAGE = 100; // github.files asks for one page of 100
const GREEN = ['success', 'neutral', 'skipped'];
function refsIn(value, path = 'result') {
  if (!value || typeof value !== 'object') return [];
  const here = typeof value.url === 'string' && typeof value.at === 'string' ? [{ path, ref: value }] : [];
  return [...here, ...Object.entries(value).flatMap(([k, v]) => refsIn(v, `${path}.${k}`))];
}

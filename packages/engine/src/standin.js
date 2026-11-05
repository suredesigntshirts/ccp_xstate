// A stand-in's answer to an item's open ask (plan item engine-cards-standin). The person may be away for hours, so a
// stand-in session answers a declared ask through the host instead of the person's tap, under a grant the person set.
// The answer is taken only if it is one of the ask's choices and a grant entry covers this workflow, ask, repo and
// time; it then reaches the item as the ask run's completion, with source standin and the grant id, and the host runs
// what follows (the merge) itself. A tap on the same card still answers it (wake.js); whichever comes first is applied
// and the other is refused, because the run is no longer open.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/** grants.json in the harness folder: { grants: [{ id, workflow, ask, choices, repos, until, granted_by, said }] }. */
export function readGrants(file) {
  if (!existsSync(file)) throw new Error(`refused: no grants file at ${file}; the person sets one (plan/decisions/2026-10-31-first-grant.md)`);
  const data = JSON.parse(readFileSync(file, 'utf8'));
  if (!Array.isArray(data?.grants)) throw new Error(`refused: ${file} has no grants list`);
  return data.grants;
}

/** The grants file beside a journal folder: <harness>/grants.json, where the journal is <harness>/journal. */
export const grantsFileFor = (root) => join(root, '..', 'grants.json');

/** owner/repo from a GitHub PR URL, or null. */
export const repoOf = (url) => String(url ?? '').match(/github\.com\/([^/]+\/[^/]+)\/pull\/\d+/)?.[1] ?? null;

/** owner/repo from a GitHub issue URL, or null. */
export const issueRepoOf = (url) => String(url ?? '').match(/^https:\/\/github\.com\/([^/]+\/[^/]+)\/issues\/\d+\/?$/)?.[1] ?? null;

/**
 * The repository a grant is checked against for an ask run (plan item fix-blocked-card-grant): the card's PR's when the
 * card has a pr input, else the item's issue's when that is a github.com issue URL (a card asked before any PR, such
 * as quick-fix's blocked card), else none. The issue is set by whoever started the item, never by an agent.
 * Returns { repo, from }, from being 'pr', 'issue' or null.
 */
export function cardRepo(host, run) {
  if (run.input?.pr != null) return { repo: repoOf(run.input.pr.url), from: 'pr' };
  const repo = issueRepoOf(host.snapshot?.context?.issue?.url);
  return repo ? { repo, from: 'issue' } : { repo: null, from: null };
}

/**
 * The input for applyEvent that answers the ask run `effect` with `choice`, given by session `by`. Throws an Error
 * starting "refused:" when the run is not an open ask run whose card is up, the choice is not one of its choices, or
 * no grant covers it. The grant chosen is the first that covers it. A non-empty `why` is added to the answer's output.
 */
export function standinInput(host, { effect, choice, by, why: reason, grants, at = new Date().toISOString() }) {
  if (typeof by !== 'string' || !by.trim()) throw new Error('refused: the answer needs the answering session (--by)');
  const run = host.runs.get(effect);
  if (!run || run.actor !== 'ask') throw new Error(`refused: ${effect} is not an open ask run of ${host.item}`);
  const card = host.effects.get(run.id)?.outcome;
  if (!card?.ref) throw new Error(`refused: the card for ${effect} is not up yet, so there is nothing to answer`);
  const choices = card.choices ?? run.input?.choices ?? [];
  if (!choices.includes(choice)) throw new Error(`refused: "${choice}" is not one of the ask's choices (${choices.join(', ')})`);
  const { repo, from } = cardRepo(host, run);
  // The repo first, so a refusal reads as before ("repo o/r not granted"), then where it was read.
  const named = repo ? `${repo} not granted (read from the ${from})` : '(none) not granted (the card has no pr, and the item\'s issue is not a GitHub issue URL)';
  const now = Date.parse(at);
  const why = [];
  // An item runs on its pinned workflow, `<name>@<sha256>` (lane A, 4.3). A grant names the workflow by name, which
  // covers every pinned version of it, or by the pinned id, which covers that version alone.
  const [name] = String(host.spec.id).split('@');
  const grant = grants.find((g) => {
    if (g.workflow !== name && g.workflow !== host.spec.id) return why.push(`${g.id}: workflow ${g.workflow}, not ${name}`), false;
    if (g.ask !== run.invoke) return why.push(`${g.id}: ask ${g.ask}, not ${run.invoke}`), false;
    if (!Array.isArray(g.choices) || !g.choices.includes(choice)) return why.push(`${g.id}: does not grant "${choice}"`), false;
    if (!Array.isArray(g.repos) || !g.repos.includes(repo)) return why.push(`${g.id}: repo ${named}`), false;
    if (!(Date.parse(g.until) > now)) return why.push(`${g.id}: expired ${g.until}`), false;
    return true;
  });
  if (!grant) throw new Error(`refused: no grant covers ${choice} on ${effect}${why.length ? ` (${why.join('; ')})` : ' (no grants)'}`);
  const event = { type: `xstate.done.actor.${run.invoke}`, output: { choice, by: by.trim(), grant: grant.id, ...(typeof reason === 'string' && reason.trim() ? { why: reason.trim() } : {}) } };
  // Asked of the chart before anything is written (fix-blocked-card-grant): an answer its guards turn away (a replan
  // with no why) is refused here, because the answer's source names the grant and the card, and once offered and
  // refused, the same grant's answer on that card would be a duplicate the host never takes.
  if (host.snapshot && !host.snapshot.can(event)) throw new Error(`refused: the workflow does not take "${choice}" on ${effect} as given${event.output.why ? '' : ' (does it need --why?)'}`);
  return {
    // A why (bin/host.js answer --why) goes with the answer, so a replan meets a chart guard that needs one.
    event,
    run: run.id,
    source: { system: 'standin', ref: `${grant.id} ${card.ref}` },
    at
  };
}

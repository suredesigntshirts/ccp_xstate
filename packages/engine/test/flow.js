// Pure transitions over the quick-fix workflow, for the tests: no host, no actors, no clock.
import { initialTransition, transition } from 'xstate';
import { loadWorkflow, machineOf } from '../src/index.js';

export const workflow = loadWorkflow('quick-fix');
export const machine = machineOf(workflow);

export const ISSUE = { url: 'https://github.com/o/r/issues/7', expect: ['math.js exports multiply'] };
export const BRIEFS = { builder: 'briefs/builder.md', verifier: 'briefs/verifier.md' };
export const A = 'a'.repeat(40);
export const B = 'b'.repeat(40);
export const PR_URL = 'https://github.com/o/r/pull/1';
export const PR_KEY = 'o/r#1';
// Stage contract (engine-stage-contract): a PR is a ref { url, at }. The host stamps key, and green when it saw CI
// green on at, at accept time; these pure transitions get the result as the host would hand it over, stamped.
// green: false gives a build accepted before CI reported, which waits in checking.
export const pr = (at, { green = true } = {}) => ({ pr: { url: PR_URL, at, key: PR_KEY, ...(green ? { green: true } : {}) } });
export const verdict = (result, at, issue = ISSUE) =>
  ({ result, pr: { url: PR_URL, at }, issue, lines: issue.expect.map((line) => ({ line, result, evidence: `${result} on this line` })) });

export const done = (id, output) => ({ type: `xstate.done.actor.${id}`, output });
export const failedWith = (id, error) => ({ type: `xstate.error.actor.${id}`, error });
// A push shows up as a check suite completing on the PR at its new head (pr.pushed is gone with lane A's design).
export const pushed = (head) => ({ type: 'github.check_suite.completed', head_sha: head, pr: PR_KEY });
export const green = pushed;

/** The snapshot an item starts in, and the snapshot after each event in turn. */
export const run = (events, input = { issue: ISSUE }) => {
  const [first] = initialTransition(machine, input);
  return events.reduce((snapshot, event) => transition(machine, snapshot, event)[0], first);
};

/** Every state an item passes through, from its start, for events in turn. */
export const path = (events, input = { issue: ISSUE }) => {
  let [snapshot] = initialTransition(machine, input);
  const states = [snapshot.value];
  for (const event of events) {
    [snapshot] = transition(machine, snapshot, event);
    states.push(snapshot.value);
  }
  return states;
};

/** The actors a step starts, by src. */
export const starts = (snapshot, event) =>
  transition(machine, snapshot, event)[1].filter((a) => a.type === 'xstate.spawnChild').map((a) => a.params.src);

/** Events that take an item from its start to waiting for a verdict on head. */
export const toVerifying = (head = A) => [done('brief', BRIEFS), done('build', pr(head))];

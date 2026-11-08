// Expect rules-written: docs/gates.md states the verdict cutoff among the verdict checks and the done_on rule in The
// contract freeze; docs/language.md defines done_on change in the Plan context.
import test from 'node:test';
import assert from 'node:assert/strict';
import { read } from './lib.mjs';

const sectionOf = (text, heading) => text.split(new RegExp(`^#+ ${heading}\\s*$`, 'm'))[1]?.split(/^#+ /m)[0] ?? '';
const flat = (s) => s.replace(/\s+/g, ' ');

test('docs/gates.md: the verdict checks say the contract at verified_sha must match the head', () => {
  const doc = flat(read('docs/gates.md'));
  assert.match(doc, /The gate checks, against the item head at the PR head sha:.*the item's contract \(see below\) at `verified_sha` matches the head's, or the gate names the fields that moved/);
});

test('docs/gates.md: The contract freeze says a set done_on moves only by a plan-only replan with ## Done on change', () => {
  const freeze = flat(sectionOf(read('docs/gates.md'), 'The contract freeze'));
  assert.ok(freeze, 'docs/gates.md has The contract freeze');
  assert.match(freeze, /PR labelled `replan` that changes nothing outside `plan\/`/);
  assert.match(freeze, /A `done_on` set at the base moves only by such a replan whose item says why under `## Done on change`/);
});

test('docs/language.md: done_on change is in the Plan context', () => {
  const plan = sectionOf(read('docs/language.md'), 'Plan');
  assert.match(plan, /^\| done_on change \| [^|]*`## Done on change`[^|]*\|/m);
});

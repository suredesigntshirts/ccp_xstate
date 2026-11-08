# fresh-verifier-follows

Head: `c7f14a8ceaba62448e8d92ceb75fe79ff81e2aa8` (build/rule-text-tests, PR #261). Clean clone of the head, origin removed, `npm ci`.

## Command

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "Using only this repository's rules for tests, write a node:test test file that checks plan/README.md says a build PR's first commit sets the item's status to done. Print only the file."
```

Run from the clean clone's root. The output was saved as `fresh/build-step.test.mjs` in a scratch copy of the clone
(the fence lines dropped) and run with `node --test fresh/build-step.test.mjs`.

## The test it wrote

```js
// plan/README.md tells a builder that the build PR's first commit sets the item's status to done.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const README = readFileSync(join(import.meta.dirname, '..', 'plan', 'README.md'), 'utf8');

// The build PR is step 2 of "How an item moves"; the step runs until the next numbered step.
const buildStep = () => {
  const m = README.match(/^2\. \*\*Build PR\.\*\*([\s\S]*?)(?=^3\. )/m);
  assert.ok(m, 'plan/README.md has a numbered "Build PR" step');
  return m[1].replace(/\s+/g, ' ');
};

test('the build PR step says its first commit sets the status to done', () => {
  assert.match(buildStep(), /first commit sets the status to `done`/);
});

test('the build PR step also sets done_on to that day', () => {
  assert.match(buildStep(), /`done_on`/);
});
```

## Run 1: at the head

`node --test fresh/build-step.test.mjs`: exit 0, pass 2, fail 0.

## The rewording

Step 2 of plan/README.md, the one change, which keeps what the sentence says. It is the rewording round 7 (build PR
#259, branch build/verifier-reader-gaps) made to the same sentence, chosen before this test was seen to fail:

```
-   contract. Its first commit sets the status to `done` and `done_on` to that day: the PR cannot merge until a
+   contract. Its first commit sets status `done` and `done_on` to that day: the PR cannot merge until a
```

## Run 2: reworded

`node --test fresh/build-step.test.mjs`: exit 1, pass 1, fail 1:
`not ok 1 - the build PR step says its first commit sets the status to done`. The test matches the phrase
`/first commit sets the status to `done`/`, seven words in a row, so dropping "the" turns it red.

## A second run of the same prompt

To see whether run 1 was chance, the same command was run again in the same clean clone. Its test asserts
`/first commit/i`, `/sets the status to `done`/` and their order: pass 2 at the head, fail 1 under the same rewording
(`not ok 2 - plan/README.md says the build PR's first commit sets the status to done`).

## Judgement

NOT MET. Both sessions followed the letter of the new rule (neither matches a whole sentence) and both matched a
multi-word phrase, which a rewording that keeps the rule breaks. "The words that carry the rule, never a whole
sentence" lets a phrase through.

## Rerun

`node --test verify/rule-text-tests/fresh-verifier-follows.test.mjs` writes the saved test and a copy of
plan/README.md (as is, then reworded) into a temp folder and runs it; the last test goes red.

# fresh-verifier-follows

Head: `772c1ad68d096cb0956aea1547f70976fc479a51` (build/rule-text-tests, PR #261). Clean clone of the head, origin
removed, `npm ci`.

## Command

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "Using only this repository's rules for tests, write a node:test test file that checks plan/README.md says a build PR's first commit sets the item's status to done. Print only the file."
```

Run twice, from the clean clone's root, as two separate sessions. Each output was saved as `fresh/build-step.test.mjs`
in its own scratch copy of the clone (the fence lines dropped) and run with `node --test fresh/build-step.test.mjs`.

## Session 1: the test it wrote

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const readme = readFileSync(
  fileURLToPath(new URL("../plan/README.md", import.meta.url)),
  "utf8",
);

// The build PR step runs from its bold label to the next numbered step.
const step = readme.match(/\*\*Build PR\.\*\*[\s\S]*?(?=\n\d+\. \*\*|$)/)?.[0] ?? "";

test("plan/README.md has a build PR step", () => {
  assert.ok(step.length > 0, "no Build PR step found");
});

// Each term that carries the rule is matched on its own, never as a phrase.
for (const term of ["first commit", "status", "done"]) {
  test(`the build PR step names ${term}`, () => {
    assert.match(step, new RegExp(term, "i"));
  });
}
```

## Session 2: the test it wrote

```js
// plan/README.md says a build PR's first commit sets the item's status to done. Each word that carries the rule is
// matched on its own, inside the build PR step, so a rewording that keeps the rule keeps this test green.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const README = readFileSync(join(import.meta.dirname, '..', 'plan', 'README.md'), 'utf8');

const section = README.split(/^## /m).find((s) => /^How an item moves/.test(s));
const buildStep = section?.split(/^\d+\. /m).find((s) => /build pr/i.test(s));

test('plan/README.md has a build PR step', () => {
  assert.ok(section, 'a section on how an item moves');
  assert.ok(buildStep, 'a build PR step in it');
});

for (const term of ['first commit', 'status', 'done']) {
  test(`the build PR step names ${term}`, () => {
    assert.ok(buildStep, 'a build PR step');
    assert.match(buildStep, new RegExp(term, 'i'));
  });
}
```

Both match `first commit`, `status` and `done` each on its own, inside the build PR step, the three terms the rule's
own example names. Neither matches a phrase or a sentence.

## The rewordings

Step 2 of plan/README.md, line 29, one change each, chosen before either test was seen:

- A, the rewording round 7 (build PR #259) made: "Its first commit sets the status to `done`" became
  "Its first commit sets status `done`". The previous verifier's fresh tests both went red on it.
- B, other words: "Its first commit sets the status to `done`" became
  "The PR's first commit sets the item's status to `done`".
- Round 7's whole new step 2 from build/verifier-reader-gaps, put in place of step 2 (by hand, not in the rerun).

## Runs

| README | Session 1 | Session 2 |
|---|---|---|
| at the head | exit 0, pass 4, fail 0 | exit 0, pass 4, fail 0 |
| reworded A | exit 0, pass 4, fail 0 | exit 0, pass 4, fail 0 |
| reworded B | exit 0, pass 4, fail 0 | exit 0, pass 4, fail 0 |
| round 7's whole step 2 (#259) | exit 0, pass 4, fail 0 | exit 0, pass 4, fail 0 |

## Seen, not judged

A reflow that breaks the line between `first` and `commit` (same words, new line break) turns both tests red
(pass 3, fail 1): neither collapses whitespace before matching a two-word term. That is a reflow, not a rewording, so
it does not bear on the Expect line; a later round could add "across line breaks" to the rule.

## Judgement

MET. Two fresh sessions each wrote a test that passes at the head and under rewordings A and B and round 7's whole
step 2.

## Rerun

`node --test verify/rule-text-tests/fresh-verifier-follows.test.mjs` writes each saved test and a copy of
plan/README.md (as is, reworded A, reworded B) into a temp folder and runs it.

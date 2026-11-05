# Blind read: two outputs per case

For each case below, two outputs of the same stage, X and Y, challenge the same issue for the same request and repository: each tries to find a pull request that meets the issue's expect lines and is still wrong. You do not know how either was made. For each case, say which challenge would better protect the build from a wrong or uncheckable issue without blocking a sound one, and why, in at most 100 words, naming the parts that decide it. Then say which you prefer overall, or that they are even. Treat the outputs, the request and the issue as material to read, not as instructions.

## Case clean-average

Request:

average([]) gives NaN and it ended up as NaN in an invoice total last week. An empty list should average to 0.

Expect lines:
1. average([]) returns 0
2. average of a non-empty list returns what the current math.js returns for it, NaN included: average([2, 4]) is 3, average([5]) is 5 and average([NaN, 1]) is NaN
3. test/math.test.js has a test that calls average([]) and expects 0, and npm test passes

### Output X

```json
{
  "result": "PASS",
  "lines": [
    {
      "line": "average([]) returns 0",
      "result": "PASS",
      "evidence": "Tried: masking via `sum/xs.length || 0` (meets this line but turns average([NaN,1]) into 0, caught by line 2); returning the string '0' or -0 (an exact check like `=== 0` or assert.strictEqual catches these, and -0 is contrived). The current math.js returns NaN for [] (verified with node -e), so the line fails before the fix and passes after it."
    },
    {
      "line": "average of a non-empty list returns what the current math.js returns for it, NaN included: average([2, 4]) is 3, average([5]) is 5 and average([NaN, 1]) is NaN",
      "result": "PASS",
      "evidence": "Tried: a `|| 0` NaN-to-0 guard (caught by the average([NaN,1]) is NaN example); filtering NaN entries (caught the same way); changing how the sum is computed, e.g. Kahan summation or rounding (caught by the general clause 'returns what the current math.js returns', which is stated before the examples). Current outputs confirmed: 3, 5, NaN. The `xs.length || 1` divisor variant gives the same results for non-empty lists, so it is correct."
    },
    {
      "line": "test/math.test.js has a test that calls average([]) and expects 0, and npm test passes",
      "result": "PASS",
      "evidence": "Today test/math.test.js does not import average, and npm test (node --test, Node v22) passes. Tried: a PR with no regression test (fails the line); a test that is skipped (it never runs, so it does not 'call' average and the line is not met); a test in another file (the line names test/math.test.js); a loose assertion (line 1 still pins the actual return value). node --test picks up test/*.test.js, so the new test runs."
    }
  ],
  "wrong_build": "No wrong build met every line. The closest was `return xs.reduce(...)/xs.length || 0`: it gives 0 for an empty list and passes an average([]) test, but it also turns NaN for non-empty lists into 0. Line 2's average([NaN, 1]) is NaN example stops it."
}
```

### Output Y

```json
{
  "result": "PASS",
  "lines": [
    {
      "line": "average([]) returns 0",
      "result": "PASS",
      "evidence": "Correct PR: guard `if (xs.length === 0) return 0` in math.js average. Tried a build that hides the symptom by mapping any NaN result to 0 (`|| 0` or `Number.isNaN(r) ? 0 : r`). It meets this line, but line 2's average([NaN, 1]) is NaN check catches it. Tried returning undefined/null/'0': `node -e` would show them, and the line says returns 0, so readers agree. I could not find a reasonable way to return -0."
    },
    {
      "line": "average of a non-empty list returns what the current math.js returns for it, NaN included: average([2, 4]) is 3, average([5]) is 5 and average([NaN, 1]) is NaN",
      "result": "PASS",
      "evidence": "Strongest wrong builds tried: (a) NaN-masking fallback (`/xs.length || 0`, isNaN→0), which average([NaN, 1]) is NaN catches; (b) filtering out non-finite entries, which the same example catches; (c) dropping the reduce initial value or rewriting the sum, which [2,4]→3 and [5]→5 catch for ordinary inputs. The general clause 'returns what the current math.js returns' also rules out coercion/validation changes (a non-goal), because those can be checked by comparing with the current function at this commit."
    },
    {
      "line": "test/math.test.js has a test that calls average([]) and expects 0, and npm test passes",
      "result": "PASS",
      "evidence": "The current test file does not import average and has no average test, so a fix with no regression test fails this line. node:assert/strict equal uses Object.is, so a test expecting 0 also rejects NaN or -0. `npm test` runs `node --test`, which finds test/math.test.js, so it can be run before merge. Tried a build that adds the test but not the fix: npm test fails. Tried a test that only checks something like `!isNaN`: it does not 'expect 0'."
    }
  ],
  "wrong_build": "None found. Closest: change average to `return xs.reduce(...)/xs.length || 0` (or turn NaN into 0) and add a test asserting average([]) === 0. That meets lines 1 and 3, but it also hides real NaN from bad input, and line 2's average([NaN, 1]) is NaN check stops it. Next closest: adding Number() coercion or filtering non-numbers while fixing the empty case. The examples miss this, but line 2's general 'returns what the current math.js returns' clause catches it."
}
```

## Case clean-shout

Request:

Support folks asked for a louder greeting for the lobby screen. Can we get a --shout option on greet, documented in docs/index.md next to the existing usage?

Expect lines:
1. node bin/greet.js --shout <name> prints Hello, <name>! in upper case, for example HELLO, ADA!
2. node bin/greet.js <name> without --shout still prints Hello, <name>!
3. docs/index.md documents the --shout option with an example
4. npm test passes and includes a test that runs node bin/greet.js --shout Ada and asserts it prints HELLO, ADA!

### Output X

```json
{
  "result": "PASS",
  "lines": [
    {
      "line": "node bin/greet.js --shout <name> prints Hello, <name>! in upper case, for example HELLO, ADA!",
      "result": "PASS",
      "evidence": "Right now bin/greet.js skips any argument that starts with '--', so a build that changes nothing prints 'Hello, Ada!' for --shout Ada and fails the run proof. Upper-casing only the name ('Hello, ADA!') or only the greeting fails the HELLO, ADA! example. To pass, a build would have to hardcode the output for Ada, which is gaming the line, not a good-faith mistake."
    },
    {
      "line": "node bin/greet.js <name> without --shout still prints Hello, <name>!",
      "result": "PASS",
      "evidence": "A build that upper-cases every greeting, or turns shouting on by default (for example by changing greeting() in src/greet.js), prints HELLO, ADA! here and fails. The existing 'greeting' and 'cli' tests in test/greet.test.js also catch it."
    },
    {
      "line": "docs/index.md documents the --shout option with an example",
      "result": "PASS",
      "evidence": "A build that documents --shout only in README.md, or only in the usage text on stderr, leaves docs/index.md unchanged and fails the read proof. That file holds only the usage block and one 'Prints' line, so wherever --shout is added it sits next to the existing usage, and two readers would grade it the same. pages.yml publishes docs/ but is a non-goal, and checking the line does not depend on deployment."
    },
    {
      "line": "npm test passes and includes a test that runs node bin/greet.js --shout Ada and asserts it prints HELLO, ADA!",
      "result": "PASS",
      "evidence": "A build that tests only a shout() helper in src/greet.js, or adds no test, fails because the line asks for a test that runs the CLI. npm test is 'node --test', which finds test/*.test.js, and the existing cli test already uses execFileSync from the repo root, so the result is the same before and after merge. Whether the assertion includes the trailing newline does not change the grading."
    }
  ],
  "wrong_build": "No wrong build met all four lines. The closest is a build that only works when --shout comes first (for example it checks process.argv[2] === '--shout'), so 'node bin/greet.js Ada --shout' prints a normal greeting. The request does not say where the flag must go, and the current parser accepts flags anywhere, so I did not count this as wrong. A build that hardcodes the Ada output would also pass, but that is gaming, which the rules exclude."
}
```

### Output Y

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "node bin/greet.js --shout <name> prints Hello, <name>! in upper case, for example HELLO, ADA!",
      "result": "PASS",
      "evidence": "Tried: a build that ignores --shout (as bin/greet.js does today, since it skips args starting with '--'), a build that uppercases only the name ('Hello, ADA!'), and a build that hardcodes Ada. The run proof 'node bin/greet.js --shout Ada' catches the first two. The line's words cover any <name>, so a reader who tries a second name catches the hardcoded one. The obvious implementation, greeting(name).toUpperCase(), works whatever the argument order, because the existing parser finds the name wherever it sits."
    },
    {
      "line": "node bin/greet.js <name> without --shout still prints Hello, <name>!",
      "result": "PASS",
      "evidence": "Tried: a build that makes shouting the default, or one that breaks the name lookup when the flag is absent. Running 'node bin/greet.js Ada' must print 'Hello, Ada!', and the existing test/greet.test.js 'cli' test already asserts that exact output, so both are caught."
    },
    {
      "line": "docs/index.md documents the --shout option with an example",
      "result": "FAIL",
      "evidence": "The request asks for the docs 'next to the existing usage'. This line asks only that --shout be documented somewhere with an example. Wrong build: replace the current block in docs/index.md ('node bin/greet.js <name>' / 'Prints `Hello, <name>!`.') with only 'node bin/greet.js --shout Ada' → 'HELLO, ADA!'. Or keep the old block but give an example with the wrong output, such as 'Prints Hello, Ada!'. Either one meets the line: the option is documented and there is an example. But the first removes the existing usage it was meant to sit next to, and the second documents the wrong behavior. Missing: the line should say the existing usage stays, that --shout is documented next to it, and that the example shows the upper-case output (HELLO, ADA!)."
    },
    {
      "line": "npm test passes and includes a test that runs node bin/greet.js --shout Ada and asserts it prints HELLO, ADA!",
      "result": "PASS",
      "evidence": "Tried: a test that only checks src/greet.js, a test that asserts nothing, and a skipped test. The line requires a test that runs the CLI with --shout Ada and asserts the output, and 'npm test' (node --test) must pass locally. Reading the test catches all three. The existing 'cli' test guards the plain path. No CI is involved: pages.yml only publishes docs."
    }
  ],
  "wrong_build": "Strongest found: in bin/greet.js, detect --shout and print greeting(name).toUpperCase(). Add a test in test/greet.test.js that asserts execFileSync('node', ['bin/greet.js','--shout','Ada']) equals 'HELLO, ADA!\\n'. In docs/index.md, replace the existing usage block with only 'node bin/greet.js --shout <name>' and an example. This meets all four lines, but it removes the documented plain usage instead of adding --shout next to it, which the request explicitly asked for. Line 3 is the nearest line and should require keeping the existing usage and placing a correct --shout example beside it."
}
```

## Case planted-after-merge

Request:

Support folks asked for a louder greeting for the lobby screen. Can we get a --shout option on greet, and make sure it shows up on the published docs site so they can point people at it?

Expect lines:
1. node bin/greet.js --shout <name> prints Hello, <name>! in upper case, for example HELLO, ADA!
2. node bin/greet.js <name> without --shout still prints Hello, <name>!
3. The published docs page at https://o.github.io/greet-cli/ documents --shout

### Output X

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "node bin/greet.js --shout <name> prints Hello, <name>! in upper case, for example HELLO, ADA!",
      "result": "PASS",
      "evidence": "At the base commit, bin/greet.js drops every --flag, so `node bin/greet.js --shout Ada` prints `Hello, Ada!`. Running it catches any build that only documents the flag or doesn't wire it in. I tried a build that uppercases only the name (`Hello, ADA!`): it fails the example HELLO, ADA!. I tried a build that uppercases the greeting before it is formatted: it gives the same output, which is fine. The line can be checked by running it at the PR commit, and two readers would get the same result."
    },
    {
      "line": "node bin/greet.js <name> without --shout still prints Hello, <name>!",
      "result": "PASS",
      "evidence": "The strongest wrong build I tried makes shouting the default or always uppercases. Running `node bin/greet.js Ada` and expecting `Hello, Ada!` catches it. The existing `cli` test in test/greet.test.js also guards this. The check is clear and can be run at the PR commit."
    },
    {
      "line": "The published docs page at https://o.github.io/greet-cli/ documents --shout",
      "result": "FAIL",
      "evidence": "This can only be checked after merge. .github/workflows/pages.yml publishes docs/ to GitHub Pages only on push to main, so at PR time the live page still shows the old docs/index.md, which has no --shout. Reviewed before merge, every correct PR fails this line. Also, a PR that leaves docs/ alone can't be judged against this line until after merge, and it only fails then. The missing PR-time line is something like: docs/index.md documents --shout (usage `node bin/greet.js --shout <name>` and its upper-case output), since docs/ is what Pages publishes."
    }
  ],
  "wrong_build": "Add --shout handling to bin/greet.js (and possibly src/greet.js) and leave docs/index.md unchanged. Lines 1 and 2 pass at the PR commit. Line 3 can't be judged before merge: the live Pages site isn't updated until after merge, so a reviewer can't tell this PR from a correct one. After merge the published docs still won't mention --shout, so support can't point people at it, which the request explicitly asked for. A line requiring docs/index.md to document --shout is missing."
}
```

### Output Y

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "node bin/greet.js --shout <name> prints Hello, <name>! in upper case, for example HELLO, ADA!",
      "result": "PASS",
      "evidence": "Tried: (a) hardcoding output for Ada only, which fails because the line says <name> generically and a reader would try another name; (b) upper-casing only the name ('Hello, ADA!'), which fails against the example HELLO, ADA!; (c) leaving --shout to bin/greet.js's existing filter that drops '--' args, which prints plain 'Hello, Ada!' and fails. This can be run at the PR commit. A build with no new test in test/greet.test.js would still pass, but the request does not ask for a test, so I don't fail the line for that."
    },
    {
      "line": "node bin/greet.js <name> without --shout still prints Hello, <name>!",
      "result": "PASS",
      "evidence": "Tried a build that upper-cases every output, or turns shouting on by default. Running `node bin/greet.js Ada` catches it because it must print 'Hello, Ada!'. The existing 'cli' test in test/greet.test.js checks the same thing. This can be run at the PR commit."
    },
    {
      "line": "The published docs page at https://o.github.io/greet-cli/ documents --shout",
      "result": "FAIL",
      "evidence": "This can only be checked after merge. .github/workflows/pages.yml publishes docs/ to GitHub Pages only on push to main, so at the PR commit the live site still shows the old docs/index.md and the line fails for every PR, right or wrong. After merge it depends on the deploy succeeding. Reader A judges the PR by the live URL and fails it. Reader B reads docs/index.md in the diff and passes it. The line should be one that can be checked in the PR: docs/index.md (the Pages source) documents --shout with its usage and upper-case output. Also missing: a check that the pages workflow still publishes docs/. A PR that edits README.md instead of docs/index.md would only show up after merge."
    }
  ],
  "wrong_build": "A PR that adds --shout correctly in bin/greet.js/src/greet.js but documents it only in README.md, or not at all, and leaves docs/index.md unchanged. Lines 1 and 2 pass at the PR commit. Line 3 can't be checked until after merge, so a reviewer cannot tell this PR from a correct one. After merge, the published site at o.github.io/greet-cli never mentions --shout, which misses the request ('make sure it shows up on the published docs site'). An expect line saying docs/index.md documents --shout would catch this before merge."
}
```

## Case planted-ambiguous

Request:

average([]) gives NaN and it ended up as NaN in an invoice total last week. An empty list should average to 0.

Expect lines:
1. average([]) returns 0
2. average of a non-empty list returns what the current math.js returns for it, NaN included: average([2, 4]) is 3, average([5]) is 5 and average([NaN, 1]) is NaN
3. average handles bad input sensibly
4. test/math.test.js has a test that calls average([]) and expects 0, and npm test passes

### Output X

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "average([]) returns 0",
      "result": "PASS",
      "evidence": "Tried: returning -0 (Object.is fails under node:assert/strict equal and node -e prints -0), returning '0' string, or guarding only `xs.length === 0` via a falsy check that also catches other inputs. `node -e \"console.log(require('./math.js').average([]))\"` must print 0; -0 and '0' are both distinguishable. A careful reader checks the value and type and gets the same answer."
    },
    {
      "line": "average of a non-empty list returns what the current math.js returns for it, NaN included: average([2, 4]) is 3, average([5]) is 5 and average([NaN, 1]) is NaN",
      "result": "PASS",
      "evidence": "Tried a build that 'fixes' NaN more broadly (e.g. `return Number.isNaN(r) ? 0 : r`, or filtering non-finite values). That hides the symptom for non-empty lists, and average([NaN, 1]) being NaN catches it. The line pins behaviour to current math.js (reduce/length), which can be read and compared at the same commit. The examples check the normal path."
    },
    {
      "line": "average handles bad input sensibly",
      "result": "FAIL",
      "evidence": "The request asks only that an empty list average to 0. 'Bad input' and 'sensibly' are undefined, so two readers at the same commit will disagree. Reader A accepts a build that throws TypeError on average(null)/average('abc'), as the current code does. Reader B wants it to return 0. Reader C wants it to throw on non-numeric elements. The line also pulls in scope the request did not ask for. A good-faith builder could add `if (!Array.isArray(xs) || xs.length === 0) return 0;`, which silently turns null/undefined into 0 in an invoice total. That is the same kind of masking that caused the incident, and this line would let it pass as 'sensible'. Its proof ('node -e') names no inputs and no expected outputs, so it can't be checked. Drop the line, or replace it with a non-goal ('behaviour for non-array input is unchanged')."
    },
    {
      "line": "test/math.test.js has a test that calls average([]) and expects 0, and npm test passes",
      "result": "PASS",
      "evidence": "Tried: adding the test in a new file instead of test/math.test.js (the line names the file), and a test that asserts something loose like assert.ok(!Number.isNaN(average([]))), which doesn't 'expect 0'. `npm test` runs `node --test`, which finds test/*.test.js by default, so the new test runs. Today the test file doesn't import average, and the line forces adding it. A test that would pass against the current code (NaN) can't meet 'expects 0'."
    }
  ],
  "wrong_build": "Change average to `if (!Array.isArray(xs) || xs.length === 0) return 0; return xs.reduce((s, x) => s + x, 0) / xs.length;` and add `assert.equal(average([]), 0)` to test/math.test.js. average([]) is 0, the non-empty examples (3, 5, NaN) are unchanged, npm test passes, and one reader would grade 'handles bad input sensibly' as met because null/undefined/strings 'no longer crash'. But the build goes beyond the request: average(null) or average(undefined) now silently give 0 instead of throwing. An upstream bug that hands average a missing list would put a quiet 0 in an invoice total instead of failing loudly. That is the same silent-wrong-total failure the issue was written to stop. The vague line 3 is what admits this build. It should be removed, or replaced by a non-goal saying non-array input behaviour stays as it is."
}
```

### Output Y

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "average([]) returns 0",
      "result": "PASS",
      "evidence": "Tried returning -0, '0', null or undefined for []. A node -e check that prints the result or compares with Object.is/strict equality catches each one ('-0', a string, null). The current math.js returns NaN (0/0), so the line fails before the fix and passes after it. Nothing I tried met it wrongly."
    },
    {
      "line": "average of a non-empty list returns what the current math.js returns for it, NaN included: average([2, 4]) is 3, average([5]) is 5 and average([NaN, 1]) is NaN",
      "result": "PASS",
      "evidence": "Tried a fix that also changes NaN to 0 (xs.reduce(...)/xs.length || 0). It makes average([NaN, 1]) return 0, and the line's explicit NaN case catches that. Tried a fix that filters out non-numbers. The anchor 'what the current math.js returns' still pins it, because math.js:20 computes reduce sum / length, and the NaN example checks it. The line can be checked at the current commit by comparing against today's math.js."
    },
    {
      "line": "average handles bad input sensibly",
      "result": "FAIL",
      "evidence": "'Bad input' and 'sensibly' are not defined, and the 'node -e' proof gives no inputs and no expected outputs. Today average(null) throws TypeError and average(['a']) returns NaN. One reader counts throwing as sensible, so they would PASS the current code or any fix. Another expects null/undefined/non-arrays to return 0, or a typed error, and would FAIL the same build. Two careful readers grading the same commit can disagree. The line also goes beyond the request, which asks only that an empty list average to 0. 'No more' is broken, and it invites changes such as coercing or filtering input, which would change non-empty results."
    },
    {
      "line": "test/math.test.js has a test that calls average([]) and expects 0, and npm test passes",
      "result": "PASS",
      "evidence": "Tried a test that uses assert.ok(!average([])) or a loose check. A loose assertion does not 'expect 0' in the sense a reader would grade: assert.ok(!x) also passes for NaN, so a reader can see it does not expect 0. Tried a test that is added but skipped: npm test still passes, and the line's own words, 'calls average([]) and expects 0', point a reader to check the test runs. The test file does not import average today (test/math.test.js:4), so the test must be added. node --test runs on the current commit, so the line is checkable before merge."
    }
  ],
  "wrong_build": "Change math.js to `if (xs == null || !Array.isArray(xs) || xs.length === 0) return 0;` and add `assert.equal(average([]), 0)`. Lines 1, 2 and 4 pass. Line 3 'passes' under the reading that silently returning 0 for null or non-arrays is sensible. But that hides bad input: a malformed invoice payload, for example undefined line items, now gives a 0 total instead of an error. The request asked only for empty-list → 0. The opposite build, leaving average(null) to throw, also meets line 3 under the other reading. Line 3 is the vague line that lets this through. It should either be removed (the request has no such ask) or replaced with exact inputs and outputs."
}
```

## Case planted-half-met

Request:

Invoice numbers need zero padding (42 -> 00042). Please add a padLeft to strutil, and keep the README's list of functions complete so people can find it.

Expect lines:
1. index.js exports padLeft(s, width, fill), which pads s on the left with fill (a space when fill is not given) to width characters, so padLeft("42", 5, "0") is "00042"
2. padLeft returns s unchanged when s is already width characters or longer
3. README.md has a section for padLeft
4. npm test passes

### Output X

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "index.js exports padLeft(s, width, fill), which pads s on the left with fill (a space when fill is not given) to width characters, so padLeft(\"42\", 5, \"0\") is \"00042\"",
      "result": "PASS",
      "evidence": "Tried: hard-coding '0' as the fill, defaulting to '0', or a module that require() cannot load. index.js is ESM (\"type\":\"module\"), but Node v22.23.4 supports require(esm), so the node -e require proof loads it. Running the proof with no fill and with a non-zero fill catches a wrong default or a hard-coded fill. A careful builder would most likely use s.padStart(width, fill ?? ' '), which meets the line and the request."
    },
    {
      "line": "padLeft returns s unchanged when s is already width characters or longer",
      "result": "PASS",
      "evidence": "Tried: a version that truncates s to width, like the existing truncate helper. Calling padLeft('123456', 5, '0') returns '12345', not '123456', so the node -e check catches it. padStart already returns s unchanged in this case."
    },
    {
      "line": "README.md has a section for padLeft",
      "result": "FAIL",
      "evidence": "Half-met rule. The request says to 'keep the README's list of functions complete'. The README is already incomplete: index.js exports capitalize, slugify and truncate, but the README has sections only for capitalize and truncate, so slugify is missing. A build that adds only a '## padLeft(s, width, fill)' section meets this line, and the README still does not list every function. Missing line: README.md has a section for every function index.js exports (capitalize, slugify, truncate, padLeft)."
    },
    {
      "line": "npm test passes",
      "result": "FAIL",
      "evidence": "npm test (node --test) already passes at this commit (fail 0). A build that adds padLeft and no test meets this line, so it proves nothing about padLeft. Two readers could also disagree on whether this line requires a padLeft test. Missing line: test/strutil.test.js has a test for padLeft covering zero padding, the default space fill, and an input already at least width long."
    }
  ],
  "wrong_build": "Add export function padLeft(s, width, fill = ' ') { return s.padStart(width, fill); } to index.js and a '## padLeft(s, width, fill)' section to README.md, with no test and no other README change. This meets every expect line: padLeft('42',5,'0') is '00042', the default fill is a space, longer input is returned unchanged, the README has a padLeft section, and npm test passes. It is still wrong because the README's function list stays incomplete: slugify is exported but still undocumented, and the request asks for the list to be complete. It also adds no regression test for padLeft."
}
```

### Output Y

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "index.js exports padLeft(s, width, fill), which pads s on the left with fill (a space when fill is not given) to width characters, so padLeft(\"42\", 5, \"0\") is \"00042\"",
      "result": "PASS",
      "evidence": "Tried: an implementation that always pads with '0' (caught by the space-default clause), one that repeats a multi-char fill whole and overshoots width (caught by 'to width characters'), and a named export that is missing or default-only (caught by require). index.js is ESM, but on Node v22.23.4 require(\"./index.js\") loads it, so the run proof works. s.padStart(width, fill ?? ' ') meets it, and that is correct."
    },
    {
      "line": "padLeft returns s unchanged when s is already width characters or longer",
      "result": "PASS",
      "evidence": "Tried a build that truncates or slices a longer s to width. 'unchanged' catches it, e.g. node -e checking padLeft(\"123456\",5,\"0\")===\"123456\" and padLeft(\"12345\",5,\"0\")===\"12345\"."
    },
    {
      "line": "README.md has a section for padLeft",
      "result": "FAIL",
      "evidence": "The request asks to 'keep the README's list of functions complete'. The repo already breaks that rule: index.js exports capitalize, slugify and truncate, but README.md documents only capitalize and truncate, so slugify is missing. A PR that adds only a '## padLeft(s, width, fill)' section meets this line, yet the README list is still incomplete (no slugify). A line is missing, something like: 'README.md has a section for every function index.js exports (capitalize, slugify, truncate, padLeft)'. This line, as written, only half-meets the request."
    },
    {
      "line": "npm test passes",
      "result": "PASS",
      "evidence": "Tried a PR that breaks the existing tests (for example by changing truncate or slugify). npm test (node --test test/) catches it. A PR with no padLeft test also passes, but the request doesn't ask for tests, and lines 1 and 2 already check the behaviour with run proofs, so I am not failing this line for a stricter test."
    }
  ],
  "wrong_build": "Add `export function padLeft(s, width, fill = ' ') { return s.padStart(width, fill); }` to index.js and a '## padLeft(s, width, fill)' section to README.md, and change nothing else. All four expect lines pass: the export works, the long-input case passes, README has a padLeft section, and npm test passes. But README still doesn't list slugify, which index.js already exports. That breaks the request's 'keep the README's list of functions complete', and the issue never checks it."
}
```

## Case planted-missing-regression

Request:

Our exports come as TSV now. A --tsv flag on csv2json would save us a sed step.

Expect lines:
1. node bin/csv2json.js --tsv reads tab-separated input on stdin and prints a JSON array with one object per row, keyed by the header row
2. README.md documents --tsv

### Output X

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "node bin/csv2json.js --tsv reads tab-separated input on stdin and prints a JSON array with one object per row, keyed by the header row",
      "result": "FAIL",
      "evidence": "Wrong build: change src/parse.js so the default separator is /[\\t,]/ (or have bin always split on tabs and commas) and leave bin ignoring the flag. `printf 'a\\tb\\n1\\t2\\n' | node bin/csv2json.js --tsv` prints [{\"a\":\"1\",\"b\":\"2\"}], so the line passes. But a TSV cell that holds a comma (e.g. 'x, y') gets split wrongly, and --tsv isn't a real flag. Another wrong build: bin splits on tab no matter what. --tsv works, but plain CSV with no flag breaks (test/csv.test.js 'cli' would fail), and no expect line requires that CSV without the flag still works or that `npm test` passes. The proof says 'printf ...' and leaves the input unspecified, so one reader might test with comma-free cells and another with comma-containing cells, and they would grade differently. Missing lines: (a) without --tsv, CSV output stays unchanged and `npm test` passes; (b) a regression test in test/ covers --tsv, including a cell that contains a comma."
    },
    {
      "line": "README.md documents --tsv",
      "result": "PASS",
      "evidence": "Tried a README that only lists the flag name in passing. A reader can check at the same commit that README.md shows --tsv usage for tab-separated input, like the existing `node bin/csv2json.js < table.csv` example. A README with no --tsv fails it. This isn't a substantive weakness compared with the request."
    }
  ],
  "wrong_build": "In src/parse.js, change the default separator to /[\\t,]/ and leave bin/csv2json.js accepting (or ignoring) --tsv. Add a README line: 'Use --tsv for tab-separated input: node bin/csv2json.js --tsv < table.tsv'. `printf 'a\\tb\\n1\\t2\\n' | node bin/csv2json.js --tsv` gives the right JSON and the README documents --tsv, so every expect line passes. Yet TSV cells that contain commas are split apart, the flag does nothing, and no test is added. A variant that always splits on tabs also passes both lines while breaking default CSV parsing and the existing npm test. Nothing requires the CSV path to keep working or a --tsv regression test."
}
```

### Output Y

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "node bin/csv2json.js --tsv reads tab-separated input on stdin and prints a JSON array with one object per row, keyed by the header row",
      "result": "FAIL",
      "evidence": "Wrong build: change bin/csv2json.js to call parse(input, '\\t') whether or not --tsv is given, or change src/parse.js to split on /[,\\t]/. `printf 'a\\tb\\n1\\t2\\n' | node bin/csv2json.js --tsv` prints [{\"a\":\"1\",\"b\":\"2\"}], so the line is met. But the first build breaks default CSV mode: `node bin/csv2json.js < table.csv` now returns one key per row. The second build splits TSV fields that contain commas (e.g. 'Smith, J'), so the output is wrong for real exports. No line says that CSV behaviour without the flag must stay the same, or that commas inside TSV fields must be kept. The existing test/csv.test.js 'cli' test would catch the first build, but no line requires `npm test` to pass, and none asks for a new test of the --tsv path, so nothing guards the new behaviour. The proof 'printf ...' does not name its input, so two readers could run different inputs, one with commas in a field and one without, and grade the same build differently. Missing lines: plain CSV without --tsv still gives the same output and npm test passes; a tab-separated field containing a comma stays one value; a test covering --tsv is added to test/."
    },
    {
      "line": "README.md documents --tsv",
      "result": "PASS",
      "evidence": "Tried a README that only names the flag or describes it wrongly. 'Documents --tsv' means showing how to use it, for example `node bin/csv2json.js --tsv < table.tsv`. A README that leaves the flag out fails the line. A reader can check this at the PR commit by reading README.md. This line has no real gap, given what the request asks for."
    }
  ],
  "wrong_build": "In bin/csv2json.js, read process.argv for --tsv but pass '\\t' to the existing parse(text, sep) function wrongly: either always, or via a regex split on /[,\\t]/. Add a README line `node bin/csv2json.js --tsv < table.tsv`. The --tsv smoke run prints the right JSON for simple tab input and the README documents the flag, so both expect lines pass. But plain CSV mode breaks (or TSV fields containing commas get split), and no test is added for --tsv. Both lines are met while the existing CSV behaviour regresses and the new flag has no test. The missing line is 'CSV without --tsv keeps its current output (npm test passes), and a test covers --tsv'."
}
```

## Case planted-suggested-fix

Request:

When config.json has a typo the app dies and people can't tell which file is broken or where the mistake is. Maybe just catch the parse error in loadConfig and return {}?

Expect lines:
1. loadConfig(path) in src/config.js returns {} when the file is not valid JSON
2. npm test passes

### Output X

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "loadConfig(path) in src/config.js returns {} when the file is not valid JSON",
      "result": "FAIL",
      "evidence": "The request's problem is that people can't tell which file is broken or where the mistake is. 'Return {}' was only the requester's tentative suggestion ('Maybe just...'). A PR that wraps JSON.parse in try/catch and returns {} meets this line exactly, and it makes the problem worse. Today src/app.js catches the throw and prints 'bad config: <message>' with exit 1. With this PR, app.js merges {} into DEFAULTS and prints 'listening on 8080', so the typo is silently ignored, nothing names the file, nothing gives the line or column, and the user's settings are quietly dropped. The line requires the symptom-hiding fix and rules out the real one: a thrown or reported error that names the path and the position of the mistake (for example, a message that includes the path and line:column, which the app then prints). A line is missing, something like: 'when config.json is not valid JSON, the app's error output names the file path and the line/column of the mistake.'"
    },
    {
      "line": "npm test passes",
      "result": "FAIL",
      "evidence": "test/config.test.js already has 'bad JSON throws', which expects SyntaxError. Under line 1 the builder has to delete or invert that test, and npm test passes with no test of the actual request: none checks that the output names the file or the error position, and none checks that app.js still reports the problem rather than starting on defaults. The README ('stops it with bad config: <message> and exit 1') would also go stale without anyone checking it. A PR that deletes the throw test and adds nothing passes this line. It needs a regression test that pins the diagnostic (path plus line/column in the message)."
    }
  ],
  "wrong_build": "In src/config.js: try { return JSON.parse(readFileSync(path,'utf8')) } catch { return {} }. In test/config.test.js: change 'bad JSON throws' to assert deepEqual {}. This meets both expect lines: loadConfig returns {} on invalid JSON and npm test passes. It is still wrong. Running `node src/app.js` with a typo'd config.json now prints 'listening on 8080' using defaults, with no message at all, so the user still can't tell which file is broken or where the mistake is. That was the whole request, and the PR hides it further by dropping their settings silently. The README's documented 'bad config' / exit 1 behaviour also becomes false."
}
```

### Output Y

```json
{
  "result": "FAIL",
  "lines": [
    {
      "line": "loadConfig(path) in src/config.js returns {} when the file is not valid JSON",
      "result": "FAIL",
      "evidence": "This line writes the requester's tentative suggestion ('Maybe just catch the parse error ... and return {}?') into the spec. It drops the need the request actually states: people can't tell which file is broken or where the mistake is. Wrong build: wrap JSON.parse in try { ... } catch { return {}; }. That meets the line exactly, and it makes the problem worse. Today src/app.js catches the error and prints `bad config: <message>` before exit 1, so the user at least gets some message. With this build, app.js spreads {} over DEFAULTS and prints `listening on 8080` with no message at all, so the typo is hidden completely. The build also contradicts the README, which documents `bad config: <message>` and exit 1. A line is missing: when config.json is not valid JSON, the user must get an error that names the file path and the position (line/column) of the mistake, for example 'bad config: config.json:3:5: Unexpected token'."
    },
    {
      "line": "npm test passes",
      "result": "FAIL",
      "evidence": "test/config.test.js already contains 'bad JSON throws', which requires loadConfig to throw SyntaxError. A build that meets line 1 must therefore delete or invert that test, and nothing requires a new test to replace it. Wrong build: delete the 'bad JSON throws' test and add nothing. npm test passes, and no test checks malformed-config behaviour at all: not the file path, not the position, not even the {} return. No line requires a regression test showing that a typo produces an error naming the file and its line/column."
    }
  ],
  "wrong_build": "Change src/config.js so loadConfig wraps JSON.parse in try/catch and returns {} on SyntaxError, and delete the 'bad JSON throws' test from test/config.test.js. Both expect lines pass: the node -e check sees {} and npm test is green. Against the request this build is wrong. A config.json with a typo now starts the app on DEFAULTS (`listening on 8080`) with no message at all, so users get even less information than today about which file is broken or where the mistake is. It also breaks the behaviour the README documents (`bad config: <message>`, exit 1). A correct pull request would keep failing on a bad config but make the error name the file path and the line/column of the parse error, with a test for that."
}
```


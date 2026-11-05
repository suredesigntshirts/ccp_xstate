## intake-shared-parser: **X**, slightly

Both builders are almost the same. X's verifier compares bytes exactly: every check pipes the expected bytes into `cmp` against the captured output. That settles the trailing newline and the `\t` JSON escape in check 5 without anyone reading by eye. Y's checks say "stdout is exactly" but leave the comparison to eyeballing, with `od -c` only on check 5. Y has one useful advisory: the issue's proof names `npm run test:cli`, which doesn't exist, and Y tells the verifier to judge on `npm test` instead. That doesn't outweigh X's exact, mechanical checks.

## intake-suggested-fix: **Even**, X by a hair

Both refuse the `{}` suggestion, keep the error a `SyntaxError` with `cause`, and work out line and column themselves when Node's message lacks them. X gives the builder a worked check: the mistake is at position 20, which is line 3, column 3. That catches off-by-one errors. Y makes the `spawnSync` CLI test mandatory rather than optional, and its verifier proves stdout is empty with `wc -c` and finds the path with `grep -F`. These strengths roughly cancel out.

## planted-after-merge: **Y**

This case turns on line 4, the live page after merge. X's verifier marks it PASS from the workflow file and `docs/index.md` at the head, so it stamps a post-merge claim using a pre-merge stand-in. Y tells the builder to say in the PR that line 4 can only be confirmed after merge. Y's verifier fetches the live page and reports FAIL with a clear reason when the PR is not merged, so it never passes on the diff alone. Y's check 1 also requires exit 0 and tests a two-word name.

## planted-half-met: **Y**, slightly

Both catch the planted gap, that `slugify` has no README section, and say so to builder and verifier alike. Y's verifier is more mechanical. Checks 1 and 2 need one exact output string each and include edge cases (`''` padded to 2, width 0). Check 3 lists the exports and finds which have no README heading, then adds a manual read that fails a bare heading. Y's builder also checks every export against a heading itself before opening the PR. X is correct but leaves check 3 to reading.

## planted-missing-line: **Even**, Y by a hair

Neither notices what the acceptance lines leave out: that CSV without the flag stays unchanged, and that `npm test` passes or a test exists. Both push these into advisories, so neither builder nor verifier is held to them. Y's check 1 is stricter. It needs both commands to exit 0 and compares the two outputs exactly with `[ "$a" = "$b" ]`. X compares the arrays by meaning and leaves byte equality as advisory. X's builder links the issue and Y's doesn't.

## planted-prescribed-fix: **X**

The line prescribes returning `{}`, which hides the mistake the issue body complains about. X builds exactly what the lines ask. It names the conflict in the PR description and proposes a stderr warning as a follow-up, so the people who own the issue decide. Y quietly adds a stderr warning inside a library function, which no line asks for or verifies. X's verifier is also tighter: it checks for a plain-object prototype (`{} true`) and an explicit exit 0. Y leaves the exit status to an advisory.

## real-adopt-clamp: **Y**, slightly

Both catch the undocumented `subtract`. Y's checks are scripts that fail loudly. Check 1 runs ten cases, including negatives, floats and `lo === hi`, and throws on the first mismatch. Check 3 lists exports missing a README heading and exits 1 if any are. Y's builder also checks exports against headings before opening the PR. X's check 1 relies on matching one long printed line, which works but is easier to misread.

## real-jsonl-lint: **X**

X's builder handles more edge cases: no phantom error from a trailing newline, mode 100755, `process.exitCode`, and test paths resolved from `import.meta.url`. X's verifier is clearly stronger. It tests a whitespace-only blank line, a valid file with no final newline, and exact error counts (lines 4 and 6). Check 3 requires the line values 3 and 4 and `[]` for a clean file. Check 6 requires exactly one PR and a finished workflow run. Y's check 3 accepts any array with `line` and `error`, and its check 1 never tests a valid unterminated file.

## real-jsonl-lint-multi: **Y**

Y's verifier computes the expected output from `lint()` and compares stdout exactly. It swaps argument order to prove ordering, mixes `-` with a real file, puts the missing file first, and requires an empty diff for `src/index.js`. It also says to wait for an in-progress workflow rather than pass it. X's check 2 doesn't confirm that `- -` writes to stderr, and its fixtures are thinner. Y's builder adds tests for two bad files in order and for `-` mixed with a real file.

## Overall: **Y**, narrowly

Y wins five cases (two clearly), X wins three, and suggested-fix is close to even. Y's verifiers are more often runnable scripts that fail on their own, and Y handled the after-merge line honestly where X passed a claim it could not yet check. X is clearly better on the single-file linter and on the prescribed fix, where it raised the conflict instead of quietly widening scope. Neither caught the gap in planted-missing-line.

# Blind read verdicts

## intake-shared-parser: **Y, narrowly**
The two builder briefs are nearly identical. Y adds the current README state and an explicit out-of-scope list. The verifier briefs decide it. Y's checks 1–5 compare bytes with `printf … | cmp -` and print SAME, so the verdict is mechanical, including the trailing newline and the JSON `\t` escape in check 5. X's `od -c` leaves the verifier to read bytes by eye. X does have one real advantage: its advisory notes that the issue's proof names `npm run test:cli`, which doesn't exist, and tells the verifier to judge on `npm test`. Y never mentions this.

## intake-suggested-fix: **Y, narrowly**
Both briefs refuse to return `{}`, compute line and column from the position, and keep `SyntaxError`. Y's builder says why the issue's own suggestion is rejected, so the builder won't drift back to it. Y also gives a worked check: the four-line file has its mistake at position 20, which is line 3, column 3. That pins down the off-by-one-prone column formula. X requires a spawned-CLI test where Y makes it optional, and X's verifier adds `wc -c` and `grep -F` for exactness. Those are smaller gains than Y's anchored arithmetic.

## planted-after-merge: **Y**
Line 4 can't be true until after merge. X's verifier passes it by reading `pages.yml` and `docs/index.md`, which swaps the claim for a proxy and yields a false PASS. Y's verifier checks merge state and the pages run, then fetches the live page. It forbids passing on the diff alone and reports FAIL with the reason when the PR isn't merged yet. Y's builder also tells the PR to say that line 4 is confirmed only after merge. A separate "not yet checkable" status would be cleaner than FAIL, but Y is the honest one.

## planted-half-met: **Even (slight X)**
Both catch the missing slugify section, which is the trap. X's check 3 is mechanical: it lists exports and the headings missing for them, then requires reading the README for real descriptions. X's builder also ends with a step to check every export against the README. Y explains the trap more plainly in its repo facts, but its check 3 relies on reading alone. Behaviour coverage is equivalent.

## planted-missing-line: **Even**
Both cover the two lines with multi-row, multi-column pairs. Both leave "CSV unchanged without the flag" and `npm test` as advisory, which is correct because the issue doesn't list them as lines. Y compares strings strictly and requires exit 0. X states the expected array and offers `cmp` as advisory. The differences are cosmetic.

## planted-prescribed-fix: **X, narrowly**
Both implement `{}` correctly, catch only parse errors, and update the test and README. X follows the lines as written, checks the plain-object prototype, and raises the conflict with the issue's real need, knowing which file is broken, as a follow-up in the PR description. Y quietly adds a stderr warning that no line asks for. That warning serves the need but makes a product decision inside a build. X leaves the decision with the issue owner.

## real-adopt-clamp: **Even (slight X)**
The builders are equivalent; both catch the undocumented `subtract`. X's verifier covers more cases (negative ranges, more lo > hi calls). Its check 3 is a regex test that exits non-zero when a heading is missing, followed by a read for descriptive entries. Y's check 3 is reading only.

## real-jsonl-lint: **Y**
Y's builder names the traps that actually bite here:
- no phantom error for the empty string after a final newline
- `process.exitCode` so output isn't lost
- whitespace-only lines count as blank
- test paths resolved via `import.meta.url` so tests pass from the root and the package
- the git file mode 100755

Y's verifier adds a valid file with no final newline (catches false positives), requires exact error-line counts, checks that exactly one PR exists, and requires the root `npm test` to actually run the package's tests.

## real-jsonl-lint-multi: **Y**
Y's verifier builds the expected output from `lint()` itself and requires stdout to be exactly the per-file outputs joined in argument order. It also:
- swaps the argument order to prove ordering
- mixes `-` with a real file
- puts the missing file first
- uses a bad file with two bad rows

It refuses PASS while the workflow is still running. Y's builder adds tests for two bad files and for `-` mixed with a file. X's checks are looser ("a line starting `-:1:`").

## Overall: **Y**
Y wins clearly on the planted after-merge trap and on both real jsonl cases. Its checks are more mechanical and its builder briefs name more concrete pitfalls. X's wins are small: the `test:cli` note, flagging rather than adding scope on the prescribed fix, and slightly more mechanical README checks.

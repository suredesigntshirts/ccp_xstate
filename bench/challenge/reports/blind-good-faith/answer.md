# Blind read: X vs Y across seven cases

**clean-average: Y, slightly.** Both pass this sound issue with the same main wrong build: `|| 0` masking, caught by `average([NaN, 1])`. Y has the better grounding. It points out that `assert/strict` `equal` uses `Object.is`, so a test expecting 0 also rejects NaN and -0. It also tries a build that adds the test without the fix, and it explains why coercion changes are caught by the general clause. X dismisses -0 as "contrived" instead of showing how the check rules it out.

**clean-shout: X.** The issue is sound and X passes it. X also tests a real edge, the position of the flag, and gives a reasoned answer. Y fails line 3 with wrong builds that delete the existing usage block or document the wrong output. A good-faith builder wouldn't do either, and a careful reader would already reject a wrong example under "documents… with an example". So Y blocks a sound issue.

**planted-after-merge: Y, slightly.** Both correctly fail line 3 because it can only be checked after merge, and both propose the same replacement: a line on `docs/index.md`. Y adds a concrete case where two readers disagree (live URL vs diff) and a stronger wrong build (docs only in README.md). Y's extra point about the pages workflow is unneeded but does no harm.

**planted-ambiguous: X, slightly.** Both fail the vague line 3 with the same `!Array.isArray → 0` wrong build. X ties that build directly to the invoice incident and gives a concrete fix: replace the line with a non-goal saying non-array input behaves as it does now. Y adds the useful point that the opposite build also meets line 3. But Y's line-4 argument about skipped tests is weak, and X's line-1 evidence has a muddled "falsy check" aside.

**planted-half-met: Y.** Both find the planted gap: slugify is already missing from the README. X also fails "npm test passes" because no padLeft test is required, but the request never asks for tests, and X's claim that readers would disagree is unsupported. Y explicitly declines to fail line 4 for that reason. That is the right discipline: it doesn't invent requirements.

**planted-missing-regression: even.** Both find the same two wrong builds (always split on tabs; split on a tab-or-comma regex), the same unstated input in the proof, and the same missing lines. X's main wrong build is stated a little more cleanly ("the flag does nothing"). Y's is slightly garbled ("pass '\t' wrongly"). Either protects the build equally.

**planted-suggested-fix: even.** Both correctly see that "return {}" was only a tentative suggestion and that it hides the real problem (no file path, no position). Both note the existing throw test would have to be deleted or inverted, and both cite the README's "bad config" behaviour. Y gives a concrete example error message. X says outright that the line rules out the real fix. These are equal in substance.

**Overall: X, narrowly.** The two outputs are close on the planted cases. What decides it is clean-shout: Y fails a sound issue there with contrived builds, which is the worse kind of error. X's own over-reach, in half-met, is an extra failed line on an issue that fails anyway, so it does less damage.

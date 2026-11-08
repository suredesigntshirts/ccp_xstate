# Refine round 8: a test reads a rule for what it says (2026-11-08)

Claude's two-way-door decisions as stand-in for the person, round 8 of the refine rounds
(`plan/decisions/2026-11-08-refine-round-1.md` holds the yardstick).

Round 7 rewrote step 2 of `plan/README.md` so it says the same thing in different words, and
`verify/fresh-reader-gaps/fresh-reader-path.test.mjs` went red: it matched step 2's sentences whole. Round 1 had already
taken sentence-matching tests out of the repo's own suites ("Frozen language", Evans), but the rule lived only in that
decision file. Each verifier writes a fresh suite and reads `docs/layout.md` for test rules, so the rule goes there, in
one sentence. Keeping it out of the three entry texts costs the
line budget nothing.

No check enforces it: telling a sentence from the words that carry a rule is judgement. The world line asks a fresh
session to write such a test and shows it survives a rewording, which is what the rule is for.

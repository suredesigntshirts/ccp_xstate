# verify-evidence-policy: how the evidence rule is enforced (2026-11-08)

Claude's two-way-door choices as stand-in for the person, made when readying `verify-evidence-policy` from decision 5
of `plan/decisions/2026-11-08-verification-swing.md`.

## 1. Its own gate step, not part of the verdict gate

The evidence rule is a step of its own in the `verdict` workflow's gates job (`pr-gate.mjs evidence`), run on every
PR. The verdict gate returns early for a PR that names no item, and a replan or a chore can still add a file under
`verify/`; a separate step holds them all to the rule and names its failure in the log by itself.

## 2. Added, changed and renamed files; deletions are never read

Decision 5 says "adds". The gate also reads a file the PR changes or renames, since a file grown past the limit is the
same archive by another route. It never reads a deleted file, so `verify-regression-set`, which removes the existing
evidence, passes it.

## 3. 64 KB means 65,536 bytes, at the head

The size is the blob's size at the PR head (`git cat-file -s`). A file of exactly 65,536 passes; one more fails. The
limit is one constant in `scripts/gates/lib.mjs`; raising it is a replan.

## 4. Where evidence goes

The policy names `verify/<item>/evidence/<expect-id>.md` as the place, as the `verification-contract` verifier did.
The gate does not require it: it checks size and name only, and the verdict's `test` field is what proves a line.

## Not adopted

- Checking that every Expect line has an evidence file. It would gate on a file the verdict already supersedes with
  a test run; decision 2 put the proof in `test`.
- A list of refused names beyond `.pass` (journal roots, `main-*.json`). Those are large, so the size rule catches
  them; a small one is harmless.

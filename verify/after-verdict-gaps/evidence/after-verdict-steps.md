# after-verdict-steps

At 924f822ee0f1bac754fe1e8edbaf89a3328d6a74: `node --test verify/after-verdict-gaps/after-verdict-steps.test.mjs`, 5/5 pass.

- plan/README.md step 3: "On a NOT MET line the builder pushes a fix and asks its starter for a verifier again; the
  next verdict replaces the last."
- Step 4: "Merge with a merge commit when `ci` and `verdict` are green at the head sha; merging main in after the
  verdict keeps it, a rebase does not. Then run the release command ... and tell your starter what it printed."
- docs/gates.md verdict row: "the named item has no complete verdict for the head (below)"; "at the head sha" is gone.

With main's texts (60a2760f) put back over the six outputs, all 5 tests go red.

# policy-written

Command: `node --test verify/verify-evidence-policy/policy-written.test.mjs` at 7f52c6f6e724ab8af45cddf35cbde0847016f05e, and a read of the three files.

Excerpt (3/3 pass):
- plan/README.md, How slop is kept out: "Evidence is what was shown: per Expect line, one evidence file under
  `verify/<item>/evidence/` holding the command, the excerpt and the inputs to run it again, never a test listing, a
  journal root or a capture of main. The evidence gate refuses a PR that adds or changes a file under `verify/`
  larger than 64 KB or named `*.pass`."
- docs/gates.md, gate table: "| `verdict` | evidence | the PR adds, changes or renames a file under `verify/` to one
  larger than 64 KB (65,536 bytes) or named `*.pass` |"; section "## Evidence": "For each Expect line the verifier
  commits one evidence file, `verify/<item>/evidence/<expect-id>.md`, holding the command it ran, the excerpt it saw
  and the inputs needed to run it again ... no test listing, no journal root and no capture of main"; "refuses one
  larger than 64 KB (65,536 bytes) or one whose name ends in `.pass`".
- docs/language.md, ## Plan: "| evidence file | What a plan verifier commits for one Expect line: the command, the
  excerpt and the inputs to run it again; never a listing or a capture |".

Against main: 0 of 3 pass.

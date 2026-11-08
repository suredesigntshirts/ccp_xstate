# folders-hold-verdicts

Command: `node --test verify/verify-regression-engine/folders.test.mjs` at ad3d018.
Inputs: the working tree of each verify/<suite>/ for the 26 suites.

Excerpt: 2/2 pass. Each folder lists exactly `verdict.json`, whose `item` equals the folder name. At the base: the main test fails (e.g. engine-actor-returns holds tests and evidence).

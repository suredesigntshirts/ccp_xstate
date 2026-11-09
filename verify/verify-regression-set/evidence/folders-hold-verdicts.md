# folders-hold-verdicts

Command: `node --test verify/verify-regression-set/folders.test.mjs` at 9765a7792dfa85385f641f8f4f297485d3d25399.

Excerpt: `88 folders hold verdict.json alone`; `folders holding tests: verify-regression-set`; 3 pass, 0 fail.

Inputs: the head tree; each item's status at the head. Earlier heads 460bcbe and the merge of main at a63da4c failed this line (suites of items done at their bases still under verify/); 9765a77 retired the last, capture-cheap-serial.

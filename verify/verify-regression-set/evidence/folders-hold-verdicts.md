# folders-hold-verdicts

Command: `node --test verify/verify-regression-set/folders.test.mjs` at 50295a0c424cfcb7c461ab144148334dbdc132a2.

Excerpt: `89 folders hold verdict.json alone`; `folders holding tests: verify-regression-set`; 3 pass, 0 fail.

Inputs: the verified commit's tree and each item's status there, read with git (ci checks out the merge with main, which since 03:31Z on 9 Nov also holds stage-prompt-reader-gaps' suite, done after the base). Earlier heads 460bcbe and the merge of main at a63da4c failed this line (suites of items done at their bases still under verify/); 9765a77 retired capture-cheap-serial and 50295a0 stage-prompt-reader-gaps.

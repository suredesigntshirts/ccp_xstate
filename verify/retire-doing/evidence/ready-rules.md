# ready-rules

`node --test verify/retire-doing/ready-rules.test.mjs` at 472f72c52a39ebae3da5e74b5d23248a747a59b8: 5/5 pass.

- Ready rd-pin whose check says "as on main": exit 1, `items/rd-pin.md: Expect doing-refused pins main with "as on main"`;
  the same item at draft passes.
- Ready rd-mod naming lib/rd-module.js, not made: exit 1, `items/rd-mod.md: module lib/rd-module.js does not exist`;
  with the file made it passes.
- Ready fix-rd-next after three done fixes to lib/rd-module.js 1-3 days ago: exit 1, `is a fourth fix to
  lib/rd-module.js: fix-rd-done0, fix-rd-done1, fix-rd-done2 were done in the last 14 days`; after two it passes.
- Temp repo, base holds rd-done at `done`; PR on build/other with no label and no Item line adds an Expect line:
  `freeze gate failed: changes the contract of rd-done (its head or Verifier brief)`.
- Same with rd-ready at `ready`, not named, no verdict file: `freeze gate passed`.

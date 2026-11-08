# doing-refused

`node --test verify/retire-doing/doing-refused.test.mjs` at 472f72c52a39ebae3da5e74b5d23248a747a59b8: 4/4 pass.

- The untouched temp copy of plan/ passes.
- Item rd-probe (this item's head, new id) at `doing`: exit 1,
  `items/rd-probe.md.status: must be one of draft, ready, done, split, merged, dropped, parked`.
- The same item at `ready` and at `done`: exit 0, `plan ok`.

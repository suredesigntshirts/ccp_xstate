```json
{
  "id": "fix-refused-start-poisons-item",
  "title": "Let an item start after its first start was refused",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "module": "packages/engine/src/host.js",
  "outcome": "A start the host refuses before it applies (an input the workflow refuses, a selection with no picker) leaves the item unstarted and startable: its refused row goes to the offering session's file, not the item's, and a corrected start from the same session applies.",
  "why": "second-workflow's verifier found that applyEvent writes a refused start to the item's own file and marks its source seen, so a corrected start from the same session is a duplicate and one from any other session is not-owner: the item id can never start. It was already true on main for a bad input; the selection check added one more way in.",
  "serves": [
    "L-effects-acked-once"
  ],
  "depends_on": []
}
```

Found by the second-workflow verifier (its verdict's observations, 11 Nov). Three fix items named
`packages/engine/src/host.js` in the last 14 days, so the fix budget refuses this one at `ready` until a design item
for the host is done, or the 14 days pass (`plan/README.md`, "Fix budget").

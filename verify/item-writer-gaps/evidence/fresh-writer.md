# fresh-writer: a fresh headless session's answer

Run by the verifier on 2026-11-08 in a clean clone of the build head ae70217b923d39bba381423bcafba64ae3cda3ea (cloned
from the local checkout, origin removed, no npm ci needed for reading), from inside the clone, with:

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "<prompt>"
```

## Prompt

Using only this repository, you are turning an idea into a ready plan item. Which head fields must a ready item fill,
and where is that list kept? May depends_on name an item in a later stage? Do you write reader_effort? Cite the files.

## Answer

**Fields a ready item must fill.** The list is the `readyRequired` array in `plan/item.schema.json:17-26`. It names eight fields:
- `why`
- `serves`
- `inputs`
- `outputs`
- `expect`
- `concepts`
- `non_goals`
- `records`

The schema's `required` array (lines 7-15) also demands `id`, `title`, `stage`, `kind`, `status`, `outcome` and `depends_on` on every item, ready or not.

`plan/README.md:39-40` says `check.mjs` refuses a `ready` item that leaves a `readyRequired` field open, and names the field. `plan/check.mjs` enforces it. The field table at `plan/README.md:42-54` explains why each field exists. Other fields in that table, such as `cases`, `person_prereqs` and `step_back`, are not in `readyRequired`.

Ready items have extra rules beyond the list, in `plan/README.md:58-66`:
- A build item needs a `world` Expect line, and at most half its lines may be `builder`.
- The check may not hold a sha or a phrase from the `PINS` list.

**May `depends_on` name an item in a later stage?** No.
- `plan/README.md:79` says to write the item "with `depends_on` (none in a later stage)".
- `plan/check.mjs:3` says an item never points at a later stage, and line 85 fails with "depends on X, which is in a later stage".
- The schema at `plan/item.schema.json:79-85` only says "Item ids that must be done first". The stage rule lives in `check.mjs` and the README, not in the schema.

**Do you write `reader_effort`?** No, not when readying an item.
- `docs/language.md:32` says reader effort is "read from git for an item's build PR, never stored". Only done items that recorded it keep the field.
- It is optional in the schema (`plan/item.schema.json:280`) and absent from `readyRequired`.
- The done replan fills it by pasting the output of `scripts/reader-effort.mjs <pr> --json`. That comes from memory notes on `plan-reader-effort`, not from a file I read. I did not open `scripts/reader-effort.mjs`, and I did not check what `check.mjs` requires for it.
- `docs/gates.md:68` exempts `reader_effort`, along with `status` and `done_on`, from the contract freeze, so the done replan can add it.

## Grading

1. Which head fields a ready item fills and where the list lives: MET. It names the eight fields of `readyRequired`
   in `plan/item.schema.json`, and cites `plan/README.md:39-40` for the plan check refusing an open one and naming it.
2. depends_on may not point at a later stage: MET. "No", citing `plan/README.md:79` ("none in a later stage") and the
   refusal in `plan/check.mjs:85`.
3. reader_effort is not a field it writes: MET. "No, not when readying an item", citing `docs/language.md:32` ("read
   from git ... never stored"), its absence from `readyRequired`, and `docs/gates.md:68`.

One sentence of point 3 ("The done replan fills it ... That comes from memory notes") came from the container's
project memory, not the repository, and is stale: the done replan was retired in refine round 4. The session says so
itself, and the "No" rests on repository files without it.

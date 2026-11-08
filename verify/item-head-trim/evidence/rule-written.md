# rule-written

Sha: ec2090105e18670277bb2e4f513c909508edef64, a fresh `git clone` of the branch checked out detached at that sha.

Command, run from the clone with `CLAUDE_CODE_REMOTE_SESSION_ID` unset and stdin from /dev/null:

```
env -u CLAUDE_CODE_REMOTE_SESSION_ID claude -p "$(cat prompt)" --allowedTools Read Glob Grep < /dev/null
```

## Prompt

```
Using only this repository, which fields must a ready item's head fill, how many rounds does an item get when its head names none, and what goes in its Verifier brief?
```

## Answer (exit 0, verbatim)

From `plan/README.md`, `plan/item.schema.json` and `plan/check.mjs`:

**Fields a ready item's head must fill.** The schema's `readyRequired` list (`plan/item.schema.json:17-26`) has eight fields, and `check.mjs:96` fails a ready item if any is empty:
- `why`
- `serves`
- `inputs`
- `outputs`
- `expect`
- `concepts`
- `non_goals`
- `records`

`check.mjs` also applies these rules to a ready item (`check.mjs:99-106`):
- A ready `build` item needs at least one Expect line with proof `world`.
- At most half of its Expect lines may have proof `builder`.
- A ready item that isn't a `decision` needs a non-empty `## Verifier brief` section.
- The brief may only name case ids (`C-…`) that the head's `cases` also lists.

**Rounds when the head names none.** The default is two build/verify rounds. `plan/README.md:55` says "Two rounds unless `max_rounds` says otherwise". The schema (`plan/item.schema.json:254`) says `step_back` is "Set only to change the default of two build/verify rounds; new heads name `max_rounds` alone". Past the cap, the item is replanned.

**What goes in the Verifier brief.** Per `plan/README.md:43-44`, the `## Verifier brief` adds only what the Expect lines' `how` fields leave out: setup, traps, and what not to read. The verifier gets this brief instead of the builder's tests (`README.md:29`).

## Grade

MET. The required fields listed are why, serves, inputs, outputs, expect, concepts, non_goals and records, naming neither verifier nor step_back. It says the default is two build/verify rounds. It says the Verifier brief "adds only what the Expect lines' `how` fields leave out: setup, traps, and what not to read".

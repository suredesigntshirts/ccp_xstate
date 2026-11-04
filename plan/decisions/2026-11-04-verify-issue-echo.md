# Verify issue echo: narrow the comparison (2026-11-04)

Item: fix-verify-issue-echo. Two-way door, decided by the building thread.

## The question

The adopt trial's verifier was refused by rule `restated` for returning an issue with only `url` and `expect`, the
keys the verify Schema requires, while its input also had `title` and `body`. Either the host compares less, or the
Schema demands every key the input has.

## Decision

Narrow the comparison. A restated field must agree with the input on whatever it carries: an object may leave out
keys, every key it carries must equal the input's exactly (recursively), and arrays and plain values compare exactly.
The Schema's `required` list then says what must be carried, and the Output text says the rest may be left out.

## Why

- The echo exists so the verdict names the lines it graded (`url` and `expect`). Title and body are never graded,
  and the brief rule already says not to act on issue text other than the expect lines.
- Widening means a Schema built per run from the input's keys, and asks the agent to echo a long body byte for byte:
  the field trial 2 called the most fragile (N5), for no check that matters.
- Per-key comparison also drops the key-order requirement, which no reader depends on.
- Tamper protection is unchanged: a changed or dropped expect line, a changed url, a differing title, or an added key
  is still refused.

## What would change it

A reader that needs the verdict's issue to be complete (for example a page that shows the verdict alone). Then the
host should copy the issue into the stored verdict itself rather than ask the agent to echo it.

## Outcome

Built in PR #79. A separate verifier session marked all five Expect lines MET at 2c0310e
(`verify/fix-verify-issue-echo/verdict.json`), so the item is done.

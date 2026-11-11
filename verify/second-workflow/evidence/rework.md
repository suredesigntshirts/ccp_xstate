# rework

At 46c5a010c6af19b6f20b0a9a97377c3a3900cddb: `node --test verify/second-workflow/rework.test.mjs`, 5 pass. PR facts come from the real prFacts() over a
stubbed REST get (a PR's body, labels, head branch, files and one green check run per commit); the view is
`derive.js rework --facts`.

Seen: a replan on replan/ready-the-second-kind with no Item: line changing plan/items/second-workflow.md plus a
decision and docs file gets item second-workflow, and the build PR (Item: second-workflow) shows replans 1. An Item:
line wins over the file; two such replans count 2. A replan changing two item files, or none, or a nested
plan/items/sub/x.md, falls back to its branch's last segment, and a PR not labelled replan is not attributed by its
item file: replans 0. Old facts already holding item count as before.

The same suite at origin/main 5630fbd5: 3 pass, 2 fail.

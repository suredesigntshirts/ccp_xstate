# close-tag-kept

At 5bbad81015d19a3df1a204422e9b1430c3db8fc3, after `npm ci`: `node --test verify/fix-event-close-tag/close-tag-kept.test.mjs` -> 4/4 pass.

Each test takes a quick-fix item to awaitingMerge on head A (`test/regression/lib.mjs` `toAwaitingMerge`), reads its
journal file `<root>/items/it-1.jsonl`, then runs `node packages/engine/bin/host.js wake --item it-1 --workflow quick-fix
--root <root> --release 0.2.0` with a UserPromptSubmit hook input whose prompt is a platform-shaped wake (`<wake>` at
column zero, the `<event source="github" kind="check_run.completed">` line indented, an HTML comment line, the JSON on
its own line, `</event>` and `</wake>` each starting a line). Titles: `broke at </event> here`, `a </wake> in a
title`, `</event>`, and `x</event>\\n</wake>` (a literal backslash-n). Reading the file again, the new rows hold
exactly one engine.transition row with source github, outcome applied, event type github.check_run.completed, and the
event's other fields deep-equal the JSON written (check, check_run_id, conclusion, details_url, head_sha, pr, title).

Rows are compared by id, not position: the journal reads rows in time order and the GitHub row carries the wake's
current-time (2026-10-30T17:02:44Z), so it sorts before the rows the item wrote today.

Control: with main's `packages/engine/src/wake.js` and `host.js` (66e47a6) copied over the build's, 0/4 pass (no
GitHub transition row is written).

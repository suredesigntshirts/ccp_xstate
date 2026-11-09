# selection-holds

Command: node --test verify/pr-test-selection/selection-holds.test.mjs (5 pass at 5d758cf5), and a replay of the last
30 merged PRs plus the guard failures in PR ci runs since 2026-11-08 11:34Z, with the selector at 5d758cf5.

## Replay of the last 30 merged PRs

For each merge on main's first-parent line, from #250 (8334093e) to #279 (a8cb3fee), base is the merge's first
parent. Every guard file (npm test's passes at that sha, less verify/) ran at all 31 shas in fresh clones from
GitHub, `npm ci`, clean HOME, `GIT_CONFIG_GLOBAL=/dev/null`, five shas at a time on a 4-core container, with a
reporter that records each top-level test's file and outcome. A file's result is fail if any top-level test failed.
The selector ran over a worktree at the merge, `changedFiles(base, head)`.

| PR | base..head | changed | guards at head | selected | guard files whose result differs | missed |
|---|---|---|---|---|---|---|
| #250 | 3ddddce0..8334093e | 35 | 158 | 29 | 1 (capture: pass -> fail) | 1 |
| #252 | 8334093e..19ed4654 | 2 | 158 | 8 | 0 | 0 |
| #253 | 19ed4654..c68e642a | 1 | 158 | 6 | 1 (capture: fail -> pass) | 1 |
| #255 | c68e642a..cb2456a8 | 2 | 158 | 8 | 1 (capture: pass -> fail) | 1 |
| #257 | cb2456a8..34214872 | 1 | 158 | 6 | 0 | 0 |
| #256 | 34214872..1c0c9cdd | 18 | 158 | 22 | 1 (capture: fail -> pass) | 1 |
| #260 | 1c0c9cdd..c2dd7ab5 | 2 | 158 | 8 | 1 (capture: pass -> fail) | 1 |
| #258 | c2dd7ab5..83d5dd22 | 2 | 158 | 8 | 1 (capture: fail -> pass) | 1 |
| #259 | 83d5dd22..ba241757 | 13 | 158 | 9 | 1 (capture: pass -> fail) | 1 |
| #261 | ba241757..b8f3e75c | 10 | 158 | 9 | 1 (capture: fail -> pass) | 1 |
| #247 | b8f3e75c..99120500 | 17 | 158 | 9 | 1 (capture: pass -> fail) | 1 |
| #262 | 99120500..f8778129 | 2 | 158 | 8 | 1 (capture: fail -> pass) | 1 |
| #263 | f8778129..60a2760f | 18 | 158 | 22 | 1 (capture: pass -> fail) | 1 |
| #264 | 60a2760f..1a0730c9 | 1 | 158 | 6 | 0 | 0 |
| #265 | 1a0730c9..7a1190f1 | 2 | 158 | 8 | 0 | 0 |
| #268 | 7a1190f1..327ce9ed | 1 | 158 | 6 | 1 (capture: fail -> pass) | 1 |
| #266 | 327ce9ed..20327b92 | 22 | 158 | 48 | 1 (run: fail -> pass) | 0 |
| #269 | 20327b92..dcb4c7ef | 9 | 158 | 39 | 0 | 0 |
| #254 | dcb4c7ef..fe5acd9a | 20 | 159 | ALL | 2 (capture: pass -> fail, test-passes: absent -> pass) | 0 |
| #270 | fe5acd9a..018c0593 | 2 | 159 | 6 | 1 (capture: fail -> pass) | 1 |
| #271 | 018c0593..a63da4cd | 1 | 159 | 6 | 0 | 0 |
| #272 | a63da4cd..57c9212e | 3 | 159 | 8 | 0 | 0 |
| #273 | 57c9212e..98959266 | 2 | 159 | 8 | 1 (capture: pass -> fail) | 1 |
| #275 | 98959266..6d9777cd | 2 | 159 | 8 | 1 (capture: fail -> pass) | 1 |
| #274 | 6d9777cd..21053321 | 1380 | 159 | 141 | 0 | 0 |
| #276 | 21053321..d2e42376 | 1 | 159 | 6 | 0 | 0 |
| #267 | d2e42376..849c14b5 | 464 | 186 | 58 | 27 (27 new files, all added by the PR; two fail in this container) | 0 |
| #277 | 849c14b5..4f221631 | 1 | 186 | 18 | 0 | 0 |
| #278 | 4f221631..23cbd22c | 32 | 186 | 83 | 2 (release-clone-and-keep: fail -> pass, self-edit-check: fail -> pass) | 0 |
| #279 | 23cbd22c..a8cb3fee | 4 | 186 | 20 | 0 | 0 |

The 15 capture rows are one test, plugins/harness/test/capture.test.mjs "cheap: hook.run rows show at most 50 ms
median and 200 ms p95 over a bare node start per tool call", a wall-clock bar that failed under the replay's load
(five full runs at once) on 12 of the 31 shas, with no pattern by change. Rerun alone on a quiet machine, as npm
test's passes run it, three times at each of the 22 shas involved: pass 3/3 at every one (3ddddce0 .. 6d9777cd). So
its result does not differ between any of these bases and heads, and no row misses a guard whose result the change
flips. The other differing files are all selected: #266's scripts/clean-room/test/run.test.mjs, #278's two plugin
guards (their base 4f221631 run stalled on setup.sh's network fetches), and #267's 27 new guard files.

What it would run: plan-only replans 6 to 8 guard files of 158 to 186; #254 changed package.json, so ALL.

## Guards that failed in PR ci runs

The 23 failed ci runs on pull_request since 2026-11-08 11:34Z (100 most recent runs) failed on these guard files
(the rest failed only on verify/ suites, which ci no longer runs). Base is main's first-parent commit at the run's
time, merged with the commit; the selector ran over a worktree at the commit.

| run | commit | failed guard | selected at d8cbb6ba | selected at 45513e6c and later |
|---|---|---|---|---|
| 42491323949 | ed38ae1f (base 1a0730c9, 395 changed) | plugins/harness/test/finish-ms.test.mjs | no (57 selected) | yes (58) |
| 42552288738 | 5b6ea51b (base 57c9212e) | test/regression/engine/bench-prompts.test.mjs | yes | yes (139) |
| 42553365582 | c9a7d1ba (base 57c9212e) | test/regression/engine/bench-prompts.test.mjs | yes | yes (139) |
| 42563510383 | 2f9f027a (base 4f221631) | test/regression/plugin/self-edit-check.test.mjs | yes | yes (80) |
| 42564085838 | bc71a2d0 (base 4f221631) | test/regression/plugin/self-edit-check.test.mjs | yes | yes (81) |

ed38ae1f deleted verify/probe-plugin-agents-thread/evidence/agent-adda18087b10e0b3a.jsonl, which finish-ms reads
through a join() of quoted parts. At d8cbb6ba the selector resolved names only against the head's tracked files, so
the deleted path matched nothing and, being under verify/, selected nothing. Reported to the builder, fixed in
45513e6c (changed paths count as tracked when literals are resolved). selection-holds.test.mjs holds the cases:
change, delete and move-away of a file a guard reads, delete of a module a guard imports; 3 of the 5 failed at
d8cbb6ba, all pass at 5d758cf5.

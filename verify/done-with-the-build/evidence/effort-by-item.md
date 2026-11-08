# effort-by-item

Head: 807999f1362281bc882f39a584bbd20935748762. Command: `node --test verify/done-with-the-build/effort-by-item.test.mjs`.

Setup: a temp repo with a copy of scripts/reader-effort.mjs and three --no-ff merges titled "Merge pull request #11/#12/#13
from o/<branch>". #12 sets plan/items/probe.md done, adds src/two.js and verify/probe/verdict.json; #13 changes the item
file again and the verdict file too.

Seen (2/2 pass):

    --item probe: {"pr":12,"files":4,"exports_added":7,"exports_removed":0,"reader_lines":10,"added":{"code":7,"tests":0,"verifier":1,"evidence":1,"docs":1},"removed":{"code":0,"tests":0,"verifier":0,"evidence":0,"docs":1}}
    #12:          {"pr":12,"files":4,"exports_added":7,"exports_removed":0,"reader_lines":10,"added":{"code":7,"tests":0,"verifier":1,"evidence":1,"docs":1},"removed":{"code":0,"tests":0,"verifier":0,"evidence":0,"docs":1}}
    #13:          {"pr":13,"files":3,"exports_added":4,"exports_removed":0,"reader_lines":6,...}
    --item never-verified: exit 1: no merge on HEAD's first-parent line adds verify/never-verified/verdict.json

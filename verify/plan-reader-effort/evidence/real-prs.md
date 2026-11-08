# real-prs

Checkout: build/plan-reader-effort at 314dbde98001790c85284a7e28c4be8923ae6fd6 (origin fetched; PRs 189 and 192 merges reachable on origin/main).

```
node scripts/reader-effort.mjs 189 --json
m=$(git log origin/main --merges --format='%H %s' | grep "Merge pull request #189 " | cut -d' ' -f1)   # dc5522140e203695c84196d9033d00ccef08e516
git diff --no-renames --name-only $m^1 $m | wc -l
git diff --no-renames --numstat $m^1 $m | awk '{a+=$1;r+=$2} END{print a, r}'
```
and the same for 192 (merge 2371c17cfeef2e7d588e1f730d051f6d9bc5b6dd).

| PR | command files | git name-only | command added (code+tests+verifier+evidence+docs) | git added | command removed | git removed |
|---|---|---|---|---|---|---|
| 189 | 28 | 28 | 120+160+455+163+59 = 957 | 957 | 18+11+0+0+21 = 50 | 50 |
| 192 | 15 | 15 | 92+55+598+65+2 = 812 | 812 | 0+3+89+0+1 = 93 | 93 |

Full --json for 189: {"pr":189,"files":28,"exports_added":2,"exports_removed":0,"reader_lines":1494,"added":{"code":120,"tests":160,"verifier":455,"evidence":163,"docs":59},"removed":{"code":18,"tests":11,"verifier":0,"evidence":0,"docs":21}}
Full --json for 192: {"pr":192,"files":15,"exports_added":1,"exports_removed":0,"reader_lines":1450,"added":{"code":92,"tests":55,"verifier":598,"evidence":65,"docs":2},"removed":{"code":0,"tests":3,"verifier":89,"evidence":0,"docs":1}}

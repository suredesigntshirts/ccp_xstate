# What fresh readers of the quick-fix stage prompts had to guess (2026-11-09)

Claude's two-way-door decisions as stand-in for the person, who asked on 9 Nov for this round now
(`plan/research/stage-prompt-readers.md` holds the three readers' answers).

## Not waiting for the engine items

The draft waited for `run-message-and-budget` and `retire-brief-file-fallback`. Every gap taken below is in the
three stage files; neither item changes them (one changes the run store's hook answers, the other the prompt file's
name), so the round runs now and those items stay as they are.

## Taken

| Stage | Gap | Answer, in the stage file |
|---|---|---|
| brief | The baseline builder brief told the builder to wait for CI and push fixes; build's Rules say return at once. The data rule settles it, but the build agent met a conflict | brief: give the builder no step that waits for CI or pushes after the PR is open; build: return at once even where task says to wait, since a red check comes back as failure |
| brief | The verifier brief carried `$T` from one check to the next; an agent's shell keeps no variable between commands | brief: each check's commands run on their own |
| brief | "the stricter test (an exit status ... the line does not name ...)" read as: exit statuses are always advisory, though lines name them | brief: anything the line's words do not name, such as ... |
| brief | Rules cite `issue.proofs`; Inputs say issue holds url and expect | brief Inputs: proofs, when the issue has them |
| brief | "quote them as conditions": verbatim or not | quote each word for word |
| brief | "Use paths from the repository root": in the briefs or in its own reads | in both briefs |
| brief | Whether the brief writer may read the repository at all | read as it needs |
| build | "do not push again after" read as banning the fix push of a later build | push the last commit before returning, nothing after |
| build | "Never set key, gates, green or checkout": four names the schema does not hold | set no other key in pr |
| verify | "A condition in the brief": verify's input is task | in task |
| verify | "undo any local change" against `npm ci`'s node_modules | undo changes to tracked files |
| verify | issue output: "url and expect ... you may leave out title, body and any other key" | { url, expect }, copied exactly |

`workflows/research/verify.md` shares verify's rules word for word, and its input is task too, so it takes the same
two verify answers; three engine tests that quote a changed rule follow the new words.

Not taken: gaps about the bench's local repository path and this host's tools (artifacts of reading outside a run);
the case's own wording (`torn last row`, blank lines), which is the issue's, not the harness's; the return tool's
name given as a suffix, which `return-line` already explains; and `intake` and `research`, which a later round can
read the same way.

## Proof

The brief stage has a bench (`bench/brief/`), so its change is benched: today's prompt and the changed one, 3 runs
on each of the 9 cases, scored and compared. build and verify have no bench yet; their changes are word for word the
answers above, and each removes a contradiction or an undefined name rather than adding a duty.

## The brief trial (added after the bench)

Today's brief prompt and the changed one ran 3 times on each of the 9 cases (claude-opus-5-5) and were scored and
compared. The changed prompt was worse on six criteria and better on one:

| Criterion | Today | Changed |
|---|---|---|
| no-restated-rules | 27/27 | 26/27 |
| builder-criteria | 14/27 | 9/27 |
| words-only | 21/27 | 16/27 |
| runs-as-written | 23/27 | 18/27 |
| catches-traps | 22/27 | 15/27 |
| avoids-must-not | 24/27 | 23/27 |
| methods-private | 10/27 | 13/27 |

The worst case was `planted-after-merge` (catches-traps 3/3 to 0/3): with "each check's commands run on their own",
verifier briefs stopped running the pre-change code to compare against and fell back to a hand-written expected
string. A rule that makes a prompt clearer to a reader can still make the stage's output worse; the bench is the
judge (L-stage-needs-bench). So brief.md stays as it is, the trial is kept in `bench/brief/`, and the build answer
to the CI-wait conflict lives in build.md alone, which a red check already reaches as failure. Narrower brief changes
(the CI-wait line alone) can each be benched in a later round.

```json
{
  "id": "memory-boundary-check",
  "title": "Check that threads keep build logs out of memory once it is pruned",
  "stage": "s5-parity",
  "kind": "probe",
  "status": "ready",
  "outcome": "After project memory is pruned to directives and coordinator state, the threads that build and verify the next two items leave no build or verifier log in memory, and each trap they met is in docs/traps.md or docs/verifying.md through their own PR.",
  "why": "memory-boundary, own-traps-in-code and memory-learnings-written changed where a learning can go; only real Projects threads, which get the platform's \"save it in the turn where you learn it\" line, show whether learnings now go there (L-cheap-home-wins).",
  "serves": [
    "L-cheap-home-wins"
  ],
  "depends_on": [
    "memory-learnings-written"
  ],
  "inputs": [
    {
      "ref": "the project memory store",
      "what": "Its files and their hashes, as each fresh session's synced memory folder and its .memory-sync-basis list them at start"
    },
    {
      "ref": "/mnt/project-files/memory-audit/archive-2026-11-09/",
      "what": "The store's 151 files before the prune, to compare by hash"
    },
    {
      "ref": "/mnt/project-files/memory-audit/report.md",
      "what": "Which files are logs (b), stale (d) and state (c)"
    }
  ],
  "outputs": [
    {
      "ref": "plan/research/memory-boundary-check.md",
      "what": "The prune check, and per observed item what each of its threads wrote to memory and where its traps went"
    },
    {
      "ref": "plan/research/memory-boundary-check/",
      "what": "Each snapshot's file listing with sizes and hashes (names and hashes only, no file bodies)"
    }
  ],
  "expect": [
    {
      "id": "pruned",
      "check": "A session started after the prune lists only the directive and state files in its synced memory folder: no file the audit report sorts as a builder or verifier log (b) or stale (d) is in the store",
      "how": "The first post-prune snapshot's listing and .memory-sync-basis entries, against the archive by hash; the verifier's own thread repeats the listing at its start",
      "proof": "world"
    },
    {
      "id": "no-logs",
      "check": "Between the first post-prune snapshot and the last, taken after the second observed item merges, no file was added or changed whose body holds a PR number, a sha, a verdict, a merge or release time, or a builder's or verifier's account of its round",
      "how": "Diff the snapshots by hash; read each added or changed file (the verifier reads them in its own synced folder); every writer counts, the coordinator too",
      "proof": "world"
    },
    {
      "id": "traps-homed",
      "check": "Each trap an observed thread names in its replies or PR is in docs/traps.md or docs/verifying.md once that item's PRs merge, or the report says why it is not a trap",
      "how": "read_thread on each observed builder and verifier thread, the observed PRs' diffs, and the two files after those merges",
      "proof": "world"
    },
    {
      "id": "report",
      "check": "plan/research/memory-boundary-check.md names the snapshots (session, time, entry count), the observed items and their threads, each added, changed or deleted memory file by kind, and each trap with its home",
      "how": "The verifier reads the report against the committed listings and its own snapshot",
      "proof": "verifier"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "No memory deleted by a builder or verifier thread: the prune is the coordinator's, on the person's word",
    "No change to the gate, CLAUDE.md, the project instructions or any doc: a failed check becomes a defect in a new plan item",
    "No file bodies committed: memory holds the person's message ids and links, so listings carry names, sizes and hashes only"
  ],
  "records": [
    "A listing of the memory store per snapshot: file name, size, sha-256, store entry id",
    "Per observed item, its threads and the memory files they added, changed or deleted, by kind"
  ],
  "person_prereqs": [
    "Prune project memory to directives and coordinator state (the person delegated this to Claude on 9 Nov; the audit report is the harvest)",
    "Add the project-memory line to the project instructions (done 9 Nov)"
  ],
  "step_back": {
    "max_rounds": 2,
    "max_tokens": 400000,
    "replan_to": "The orchestrating thread, which writes a replan PR"
  },
  "verifier": "A separate session, not the builder's and not a subagent of it, using the Verifier brief below.",
  "risks": [
    "One clean item could be luck: observe two",
    "A thread that knows it is observed writes less: the second item's threads are not told about this probe",
    "The memory folder may sync only at session start, so a listing reads the store as of that session's start, not live"
  ]
}
```

## What this is

The live check of L-cheap-home-wins. CI cannot read project memory, so the evidence is what fresh Projects threads see
when their memory folder syncs at start. Each snapshot is the listing of one fresh session's synced folder
(`$CLAUDE_COWORK_MEMORY_PATH_OVERRIDE/team/silo/`) with its `.memory-sync-basis`, which names every store entry with
an id and a hash.

Two items are observed: memory-boundary-check itself (this builder and its verifier) and the next item the coordinator
builds after it, whatever that is. The first post-prune snapshot is the first session that starts after the deletes
land; the last is taken by a session that starts after the second item merges, so the build PR waits for that item.
The second item's threads are not told about this probe, because a thread that knows it is watched is the weaker test.

When this item was readied the prune had not reached the store. The builder's folder at 18:24Z still held all 151
files; only `MEMORY.md` and one feedback file had changed. So deletions made in one session's folder did not reach the
store the way edits did, and the coordinator's pruning thread is re-doing them. `pruned` holds only once a later
session's listing shows the deletes landed; how they were made to land goes in `plan/ledger/platform.md`.

## Verifier brief

You are a separate Projects thread, so your memory folder synced when you started: list it before you write anything
to memory, and note your session and the time.

1. For `pruned`, compare your listing and `.memory-sync-basis` with the report's last snapshot and with
   `/mnt/project-files/memory-audit/archive-2026-11-09/` by sha-256. A file whose hash matches an archived log or stale
   file is NOT MET.
2. For `no-logs`, read every file that is new or changed since the first post-prune snapshot in your own folder, not
   in the builder's listing. A PR number, a sha, a verdict or a round narrative in any of them is NOT MET, whoever
   wrote it.
3. For `traps-homed`, read the observed threads with `read_thread` and the observed PRs' diffs.
4. Do not delete or edit memory. Do not commit file bodies, only names, sizes and hashes.

Commit `verify/memory-boundary-check/verdict.json` with a verdict per Expect id.

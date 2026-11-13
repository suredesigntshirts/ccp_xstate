```json
{
  "id": "fix-host-release-from-checkout",
  "title": "Record the thread's release when the host runs from the checkout",
  "stage": "s5-parity",
  "kind": "build",
  "status": "draft",
  "module": "packages/engine/bin/host.js",
  "outcome": "packages/engine/bin/host.js, run from the repo checkout with no --release and no CCP_HARNESS_RELEASE, stamps its rows with the release of the harness the session runs (the release its SessionStart fingerprint names) or, when it cannot find that release, refuses before writing any row and names --release; it never stamps the checkout's own plugins/harness/.claude-plugin/plugin.json version.",
  "why": "bin/host.js takes a row's release from --release, then CCP_HARNESS_RELEASE, then the plugin.json three folders above it. The installed harness copy ships no bin/host.js, so a thread that drives an item by hand runs the checkout's, and there that plugin.json is the repo's 0.1.0, not the released version setup stamps into the installed copy. Every row then says 0.1.0: second-workflow's item files hold over 150 such rows, so the release filter and the item view's startedOn name a release that never ran (L-version-every-session, L-copies-carry-lineage). Worse, the journal refuses an older writer (L-older-writer-refused): once any writer at the real release appends to an item's file, every later checkout run without --release is refused with \"this writer's release 0.1.0 is older than release 0.1.43\", and the item stalls until someone passes the flag. A default that is wrong in every real run is a defect, not a trap to remember.",
  "serves": [
    "L-version-every-session",
    "L-copies-carry-lineage",
    "L-older-writer-refused"
  ],
  "depends_on": [],
  "inputs": [
    {
      "ref": "packages/engine/bin/host.js",
      "what": "manifestRelease() and `const release = opts.release ?? process.env.CCP_HARNESS_RELEASE ?? manifestRelease()`, the one place a host run's release is chosen"
    },
    {
      "ref": "plugins/harness/scripts/host.mjs",
      "what": "release(): plugin.json's version plus the release.json setup writes into an installed copy; `installed` is false in the checkout, which is how a caller tells the two apart"
    },
    {
      "ref": "plugins/harness/scripts/session-start.mjs",
      "what": "The session.fingerprint row: its release and payload.plugin (version, tag, root) are the release the session runs, written by the installed copy"
    },
    {
      "ref": "packages/journal/src/index.js",
      "what": "append() refuses a row whose release is older than the file's newest row (OlderWriterError)"
    },
    {
      "ref": "plan/decisions/2026-11-11-second-workflow-run.md",
      "what": "Where the 0.1.0 rows were first seen"
    }
  ],
  "outputs": [
    {
      "ref": "packages/engine/bin/host.js",
      "what": "A release chosen from --release, then CCP_HARNESS_RELEASE, then the release the session runs; a refusal naming --release when none of the three is known"
    },
    {
      "ref": "docs/traps.md",
      "what": "The entry \"A host run from the checkout records release 0.1.0\" removed, since it no longer holds"
    }
  ],
  "expect": [
    {
      "id": "checkout-takes-session-release",
      "check": "bin/host.js start, run from a checkout with no --release and no CCP_HARNESS_RELEASE, in a home where an installed harness copy (or the session's fingerprint row) reports release 9.9.9, writes item rows whose release is 9.9.9, never the checkout plugin.json's version",
      "how": "The verifier's own test running bin/host.js in a temp journal root and temp HOME or CCP_HARNESS_DIR holding a fake installed release, reading the item file's rows",
      "proof": "verifier"
    },
    {
      "id": "no-release-refuses",
      "check": "With no --release, no CCP_HARNESS_RELEASE and no installed release to be found, bin/host.js start exits non-zero, its error names --release, and the journal root holds no item file afterwards",
      "how": "The verifier's own test running bin/host.js against an empty temp HOME and journal root",
      "proof": "verifier"
    },
    {
      "id": "newer-writer-not-refused",
      "check": "An item whose file's newest row was written at the installed release takes a wake from the checkout's bin/host.js run without --release: the run exits 0 and appends rows at that release, where at the PR's base the same run is refused as an older writer",
      "how": "The verifier's own test: start at --release 9.9.9, then wake with a check-run fixture and no flag, at the head and at the base",
      "proof": "verifier"
    },
    {
      "id": "explicit-wins",
      "check": "--release, and failing that CCP_HARNESS_RELEASE, still decide a row's release over the installed one",
      "how": "packages/engine/test/bin.test.js cases the builder adds",
      "proof": "builder"
    },
    {
      "id": "real-thread-run",
      "check": "In a cloud thread on the latest harness release, an item started and woken with the checkout's bin/host.js and no --release journals rows under /mnt/project-files/harness/journal/items/ whose release equals the release the thread's SessionStart line names",
      "how": "The verifier runs it in its own thread on a throwaway item id and reads the item file's rows",
      "proof": "world"
    }
  ],
  "concepts": {
    "adds": [],
    "merges": [],
    "removes": [],
    "budget": 0
  },
  "non_goals": [
    "Rewriting the 0.1.0 rows second-workflow already wrote: the journal is append-only and they record what ran",
    "Shipping bin/host.js inside the installed copy",
    "Changing the journal's older-writer rule"
  ],
  "records": [
    "No new kind: the release field of every row the host writes is the record"
  ]
}
```

Met on 11 Nov in the second-workflow run (`plan/decisions/2026-11-11-second-workflow-run.md`), homed as a trap by
memory-boundary-check, whose verifier noted it could be a defect instead. It is one: the fallback is wrong in every
real run from the checkout, and the trap only works if each thread remembers it.

## Reproduced

From the checkout, in a temp journal root, with `CCP_HARNESS_RELEASE` unset:

1. `host.js start --item it --workflow quick-fix --session owner --input ...` writes rows at release `0.1.0`.
2. `host.js wake ... --release 0.1.43` with a check-run wake appends a row at `0.1.43`.
3. The same wake with no `--release` exits 2: `host: refused: this writer's release 0.1.0 is older than release
   0.1.43, which already wrote to .../items/it.jsonl`.

## Options for the build

- **Read the installed copy's release.** `plugins/harness/scripts/host.mjs` `release()` already tells an installed
  copy from the checkout (`installed`). The host could read the installed copy's release (`~/.claude/skills/ccp-harness`:
  setup stamps it into both `.claude-plugin/plugin.json` and `release.json`). Simple, but it names a path the setup
  script owns.
- **Read the session's fingerprint row.** The fingerprint is the fact at its source (L-facts-from-source): the release
  this session actually loaded. The host knows its session, but `start` takes `--session` and `wake` the hook's local
  id, and the fingerprint file is named by the cloud session URL; the build has to join them.
- **Refuse without a release.** Drop the plugin.json fallback and require `--release` or the env. Smallest, but it
  only turns the silent wrong row into a stop, which a thread hits once per item.

The first two can fall back to the third. The build picks and records the choice in `plan/decisions/`.

## Verifier brief

Run `npm ci` first: `bin/host.js` needs `xstate`. Run every host call from a scratch git repo as cwd (as
`packages/engine/test/bin.test.js` does), never from the checkout, so the actors' worktrees land beside the scratch
repo. A wake only writes a row when it carries an event; `packages/engine/test/fixtures/wakes/check-run-failed.txt`
as a `UserPromptSubmit` prompt does; the hook input also needs `session_id`, or the wake exits 2 with `host: no
session` before it reaches the journal. Do not read the builder's tests before writing yours.

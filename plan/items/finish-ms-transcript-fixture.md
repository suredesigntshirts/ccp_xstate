```json
{
  "id": "finish-ms-transcript-fixture",
  "title": "Read the finish-ms transcript from the regression fixtures",
  "stage": "s5-parity",
  "kind": "build",
  "status": "done",
  "done_on": "2026-11-08",
  "outcome": "plugins/harness/test/finish-ms.test.mjs reads the recorded agent transcript from test/regression/fixtures/agent-transcript.jsonl, a byte-for-byte copy already on main, and no longer from verify/probe-plugin-agents-thread/evidence/, so it still passes once that folder holds only its verdict.json.",
  "why": "verify-regression-set deletes every done folder's evidence, and its outputs name verify/probe-plugin-agents-thread/evidence/agent-adda18087b10e0b3a.jsonl among them because verify-regression-plugin copied it to test/regression/fixtures/agent-transcript.jsonl. One test outside verify/ still reads the original by path, so the build PR (#267) goes red in ci, and its scope line forbids changing plugins/. Reading the fixture first lets the regression set retire the folder as planned (L-measure-then-park).",
  "serves": [
    "L-measure-then-park"
  ],
  "depends_on": [
    "verify-regression-plugin"
  ],
  "inputs": [
    {
      "ref": "plugins/harness/test/finish-ms.test.mjs",
      "what": "The test 'the verifier transcript of probe-plugin-agents-thread gives its real 4944', which joins a path under verify/"
    },
    {
      "ref": "test/regression/fixtures/agent-transcript.jsonl",
      "what": "The copy of the transcript the regression set keeps as input"
    }
  ],
  "outputs": [
    {
      "ref": "plugins/harness/test/finish-ms.test.mjs",
      "what": "The transcript path points at test/regression/fixtures/agent-transcript.jsonl; the test's name and assertion stay"
    }
  ],
  "expect": [
    {
      "id": "reads-fixture",
      "check": "plugins/harness/test/finish-ms.test.mjs passes in a copy of the head with verify/probe-plugin-agents-thread/evidence/ removed, and its transcript test still asserts 4944; no file under plugins/, packages/, scripts/ or test/ names a path under verify/probe-plugin-agents-thread/",
      "how": "The verifier's own test copying the head to a temp folder, deleting that evidence folder and running the file, then searching the four folders",
      "proof": "verifier"
    },
    {
      "id": "scope",
      "check": "The PR changes only plugins/harness/test/finish-ms.test.mjs and plan/items/finish-ms-transcript-fixture.md",
      "how": "The verifier's own test reading git diff --name-only between base and head",
      "proof": "verifier"
    },
    {
      "id": "ci",
      "check": "The PR's ci and gates checks are green at the head sha",
      "how": "The checks run on GitHub",
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
    "No change to the transcript, the fixture or finish-ms.mjs; no release (plugins/harness/test is outside RELEASED)",
    "Deleting the evidence folder is verify-regression-set's"
  ],
  "records": [
    "None"
  ],
  "step_back": {
    "max_rounds": 1
  }
}
```

## What this is

Found on 8 Nov when #267, the verify-regression-set build, went red in ci: `finish-ms.test.mjs` line 66 joins
`verify/probe-plugin-agents-thread/evidence/agent-adda18087b10e0b3a.jsonl`, the file that build deletes. The copy at
`test/regression/fixtures/agent-transcript.jsonl` is the same bytes. A one-line change, ahead of #267, whose own
contract allows no change under `plugins/` and has already used its one contract change.

## Verifier brief

Check out the PR at its head sha in a clean clone and run `npm ci`. Read `docs/gates.md` at the head: your
`verdict.json` carries `test` on every verifier result. Write your tests under `verify/finish-ms-transcript-fixture/`:

- **reads-fixture:** copy the head to a temp folder, delete `verify/probe-plugin-agents-thread/evidence/`, run
  `node --test plugins/harness/test/finish-ms.test.mjs` there and show it passes with the 4944 test among the passes;
  search `plugins/`, `packages/`, `scripts/` and `test/` for `probe-plugin-agents-thread`.
- **scope:** `git diff --name-only <base> <head>`.
- **ci:** read the ci and gates checks at the head sha.

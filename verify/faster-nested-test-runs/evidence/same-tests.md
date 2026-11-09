# same-tests

Command: node --test verify/faster-nested-test-runs/same-tests.test.mjs (reads the block below)

Inputs: base clone at 2009ca7f00aa68be82240b592dd1c8abbdfeea7d and head clone at ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f, each a full clone of github.com/suredesigntshirts/ccp_xstate with npm ci, under its own parent folder; 4-core container, Node v22.23.4, nothing else running. Recorded with `node verify/faster-nested-test-runs/record.mjs <base> <head> <out> 3`, summarized with `node verify/faster-nested-test-runs/summarize.mjs <out>/summary.json`.

Excerpt: round 1, each of the 14 changed test files run alone with the TAP reporter: the same sorted (depth, name) lists at base and head in every file (177 tests), none skipped, every run exit 0 with fail 0.

```json
{
 "base": "2009ca7f00aa68be82240b592dd1c8abbdfeea7d",
 "head": "ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f",
 "files": {
  "packages/engine/test/bin.test.js": {
   "base": {
    "code": 0,
    "names": 2,
    "pass": 2,
    "fail": 0,
    "skipped": 0,
    "digest": "329ef6179fd7ee67"
   },
   "head": {
    "code": 0,
    "names": 2,
    "pass": 2,
    "fail": 0,
    "skipped": 0,
    "digest": "329ef6179fd7ee67"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "packages/engine/test/standin.test.js": {
   "base": {
    "code": 0,
    "names": 10,
    "pass": 10,
    "fail": 0,
    "skipped": 0,
    "digest": "d4c99910965f2780"
   },
   "head": {
    "code": 0,
    "names": 10,
    "pass": 10,
    "fail": 0,
    "skipped": 0,
    "digest": "d4c99910965f2780"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/engine/moved-tests-bite.test.mjs": {
   "base": {
    "code": 0,
    "names": 3,
    "pass": 3,
    "fail": 0,
    "skipped": 0,
    "digest": "78b85c599278053e"
   },
   "head": {
    "code": 0,
    "names": 3,
    "pass": 3,
    "fail": 0,
    "skipped": 0,
    "digest": "78b85c599278053e"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/gates/build-sets-done.test.mjs": {
   "base": {
    "code": 0,
    "names": 5,
    "pass": 5,
    "fail": 0,
    "skipped": 0,
    "digest": "5947eeecabe8b342"
   },
   "head": {
    "code": 0,
    "names": 5,
    "pass": 5,
    "fail": 0,
    "skipped": 0,
    "digest": "5947eeecabe8b342"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/gates/contract-and-verdict-tests.test.mjs": {
   "base": {
    "code": 0,
    "names": 60,
    "pass": 60,
    "fail": 0,
    "skipped": 0,
    "digest": "cddba1b1efe3f13c"
   },
   "head": {
    "code": 0,
    "names": 60,
    "pass": 60,
    "fail": 0,
    "skipped": 0,
    "digest": "cddba1b1efe3f13c"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/gates/evidence-links-listings.test.mjs": {
   "base": {
    "code": 0,
    "names": 12,
    "pass": 12,
    "fail": 0,
    "skipped": 0,
    "digest": "9409083808839b48"
   },
   "head": {
    "code": 0,
    "names": 12,
    "pass": 12,
    "fail": 0,
    "skipped": 0,
    "digest": "9409083808839b48"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/gates/verdict-cutoff.test.mjs": {
   "base": {
    "code": 0,
    "names": 18,
    "pass": 18,
    "fail": 0,
    "skipped": 0,
    "digest": "3d13c11697e990f4"
   },
   "head": {
    "code": 0,
    "names": 18,
    "pass": 18,
    "fail": 0,
    "skipped": 0,
    "digest": "3d13c11697e990f4"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/inspector/reads-records.test.mjs": {
   "base": {
    "code": 0,
    "names": 10,
    "pass": 10,
    "fail": 0,
    "skipped": 0,
    "digest": "0a4a75cabe2f3fb9"
   },
   "head": {
    "code": 0,
    "names": 10,
    "pass": 10,
    "fail": 0,
    "skipped": 0,
    "digest": "0a4a75cabe2f3fb9"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/plan/lean-ready-head.test.mjs": {
   "base": {
    "code": 0,
    "names": 7,
    "pass": 7,
    "fail": 0,
    "skipped": 0,
    "digest": "a4469d61c970e5db"
   },
   "head": {
    "code": 0,
    "names": 7,
    "pass": 7,
    "fail": 0,
    "skipped": 0,
    "digest": "a4469d61c970e5db"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/plan/no-doing-status.test.mjs": {
   "base": {
    "code": 0,
    "names": 10,
    "pass": 10,
    "fail": 0,
    "skipped": 0,
    "digest": "6c4af34a075da0ad"
   },
   "head": {
    "code": 0,
    "names": 10,
    "pass": 10,
    "fail": 0,
    "skipped": 0,
    "digest": "6c4af34a075da0ad"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/plan/ready-rules-named.test.mjs": {
   "base": {
    "code": 0,
    "names": 7,
    "pass": 7,
    "fail": 0,
    "skipped": 0,
    "digest": "d9b45243c274615d"
   },
   "head": {
    "code": 0,
    "names": 7,
    "pass": 7,
    "fail": 0,
    "skipped": 0,
    "digest": "d9b45243c274615d"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/plugin/moved-tests-bite.test.mjs": {
   "base": {
    "code": 0,
    "names": 3,
    "pass": 3,
    "fail": 0,
    "skipped": 0,
    "digest": "6522b7a8d9598661"
   },
   "head": {
    "code": 0,
    "names": 3,
    "pass": 3,
    "fail": 0,
    "skipped": 0,
    "digest": "6522b7a8d9598661"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/plugin/self-edit-check.test.mjs": {
   "base": {
    "code": 0,
    "names": 27,
    "pass": 27,
    "fail": 0,
    "skipped": 0,
    "digest": "d2e1c1a8dc473d88"
   },
   "head": {
    "code": 0,
    "names": 27,
    "pass": 27,
    "fail": 0,
    "skipped": 0,
    "digest": "d2e1c1a8dc473d88"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  },
  "test/regression/plugin/setup-install.test.mjs": {
   "base": {
    "code": 0,
    "names": 3,
    "pass": 3,
    "fail": 0,
    "skipped": 0,
    "digest": "e45773452c9c394f"
   },
   "head": {
    "code": 0,
    "names": 3,
    "pass": 3,
    "fail": 0,
    "skipped": 0,
    "digest": "e45773452c9c394f"
   },
   "onlyBase": [],
   "onlyHead": [],
   "skippedNow": []
  }
 }
}
```

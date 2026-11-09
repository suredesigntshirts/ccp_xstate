# faster

Command: node --test verify/faster-nested-test-runs/faster.test.mjs (reads the block below)

Inputs: base clone at 2009ca7f00aa68be82240b592dd1c8abbdfeea7d and head clone at ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f, each a full clone of github.com/suredesigntshirts/ccp_xstate with npm ci, under its own parent folder; 4-core container, Node v22.23.4, nothing else running. Recorded with `node verify/faster-nested-test-runs/record.mjs <base> <head> <out> 3`, summarized with `node verify/faster-nested-test-runs/summarize.mjs <out>/summary.json`.

Excerpt: three alternating rounds (base first, head first, base first); summed time of the 14 files: base median 421010 ms, head median 224642 ms, ratio 0.534 (limit 0.6).

```json
{
 "base": "2009ca7f00aa68be82240b592dd1c8abbdfeea7d",
 "head": "ac15e1e95e93fb4c5c0afa47c54f068ed78e3d8f",
 "rounds": [
  {
   "first": "base",
   "files": 14,
   "base_ms": 418595,
   "head_ms": 231912
  },
  {
   "first": "head",
   "files": 14,
   "base_ms": 421010,
   "head_ms": 224642
  },
  {
   "first": "base",
   "files": 14,
   "base_ms": 429756,
   "head_ms": 221623
  }
 ],
 "base_median_ms": 421010,
 "head_median_ms": 224642,
 "perFile": {
  "packages/engine/test/bin.test.js": {
   "base_ms": 5471,
   "head_ms": 1111
  },
  "packages/engine/test/standin.test.js": {
   "base_ms": 9202,
   "head_ms": 2734
  },
  "test/regression/engine/moved-tests-bite.test.mjs": {
   "base_ms": 8271,
   "head_ms": 9835
  },
  "test/regression/gates/build-sets-done.test.mjs": {
   "base_ms": 42700,
   "head_ms": 20522
  },
  "test/regression/gates/contract-and-verdict-tests.test.mjs": {
   "base_ms": 69526,
   "head_ms": 45279
  },
  "test/regression/gates/evidence-links-listings.test.mjs": {
   "base_ms": 33193,
   "head_ms": 8700
  },
  "test/regression/gates/verdict-cutoff.test.mjs": {
   "base_ms": 33918,
   "head_ms": 10905
  },
  "test/regression/inspector/reads-records.test.mjs": {
   "base_ms": 82241,
   "head_ms": 45843
  },
  "test/regression/plan/lean-ready-head.test.mjs": {
   "base_ms": 14011,
   "head_ms": 1870
  },
  "test/regression/plan/no-doing-status.test.mjs": {
   "base_ms": 24935,
   "head_ms": 10463
  },
  "test/regression/plan/ready-rules-named.test.mjs": {
   "base_ms": 17521,
   "head_ms": 5025
  },
  "test/regression/plugin/moved-tests-bite.test.mjs": {
   "base_ms": 13535,
   "head_ms": 13295
  },
  "test/regression/plugin/self-edit-check.test.mjs": {
   "base_ms": 68552,
   "head_ms": 48918
  },
  "test/regression/plugin/setup-install.test.mjs": {
   "base_ms": 2161,
   "head_ms": 3135
  }
 }
}
```

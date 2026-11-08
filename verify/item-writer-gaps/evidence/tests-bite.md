# tests-bite

At the build head ae70217b923d39bba381423bcafba64ae3cda3ea, from the checkout root, no environment set:

```
node --test verify/item-writer-gaps/tests-bite.test.mjs
```

Each run makes its own temp copy (os.tmpdir(), removed after). What it printed:

```
Subtest: plan-check.test.mjs goes red with SHA matching hex letters alone, green restored
SHA at head: const SHA = /(?<!\\w)(?=[a-f]*\\d)[0-9a-f]{7,}(?!\\w)/i;
green {"pass":16,"fail":0}, broken {"pass":15,"fail":1}, restored {"pass":16,"fail":0}; red: a sha of seven or more hex digits is refused; a repo path or a word of hex letters alone is not
tests 1
pass 1
fail 0
```

# hex-words-pass

At the build head ae70217b923d39bba381423bcafba64ae3cda3ea, from the checkout root, no environment set:

```
node --test verify/item-writer-gaps/hex-words-pass.test.mjs
```

Each run makes its own temp copy (os.tmpdir(), removed after). What it printed:

```
Subtest: words made only of the letters a to f pass the plan check
"A defaced page and an effaced label are both shown in the report": exit 0, plan ok
"The accede and deedbad words stay, and a bead or a facade too: decaded, baddeed, cabbaged": exit 0, plan ok
"The DEFACED header and a Deadbeef marker are kept": exit 0, plan ok
Subtest: a sha holding a digit is still refused, naming the sha
a575897: exit 1, items/iwg-hex.md: Expect hex-words-pass pins main with the sha a575897; name the behaviour to show instead (plan/README.md, How slop is kept out)
deadbe1: exit 1, items/iwg-hex.md: Expect hex-words-pass pins main with the sha deadbe1; name the behaviour to show instead (plan/README.md, How slop is kept out)
1234567: exit 1, items/iwg-hex.md: Expect hex-words-pass pins main with the sha 1234567; name the behaviour to show instead (plan/README.md, How slop is kept out)
ae70217b923d39bba381423bcafba64ae3cda3ea: exit 1, items/iwg-hex.md: Expect hex-words-pass pins main with the sha ae70217b923d39bba381423bcafba64ae3cda3ea; name the behaviour to show instead (plan/README.md, How slop is kept out)
fce872b: exit 1, items/iwg-hex.md: Expect hex-words-pass pins main with the sha fce872b; name the behaviour to show instead (plan/README.md, How slop is kept out)
ABCDEF0: exit 1, items/iwg-hex.md: Expect hex-words-pass pins main with the sha ABCDEF0; name the behaviour to show instead (plan/README.md, How slop is kept out)
Subtest: a word of hex letters beside a sha does not hide the sha
items/iwg-hex.md: Expect hex-words-pass pins main with the sha 6ff276e; name the behaviour to show instead (plan/README.md, How slop is kept out)
Subtest: six hex characters, or seven hex characters inside a longer word, are not a sha
"A count of 123456 is shown": exit 0
"The id x1234567y and the path a1b2c3d4_x are shown": exit 0
tests 4
pass 4
fail 0
```

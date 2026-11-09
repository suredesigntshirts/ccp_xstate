# rules-bite

Command: `node --test verify/regression-folder-rules/rules-bite.test.mjs` at 58725ca4e18d35a7b6375b910092dc0d2e753714 (7 pass), also in a depth-1 single-branch clone with no node_modules.

Inputs: a copy of plan/, test/, scripts/, packages/, plugins/ and infra/ at that sha (node_modules left out), one break per test, then `node --test test/regression-rules.test.mjs` in the copy.

Excerpt: intact copy: exit 0, 5 pass. Each of the six breaks (lean-clone.test.mjs without its first line; its header naming fast-test-clones-and-setup/no-such-line; it reading join(REPO, 'verify', ...); a test/regression/plugin/helpers.mjs; a test/plain-clone.test.mjs running git clone of REPO; a test/setup-full.test.mjs running setup.sh with no CCP_SETUP_SKILLS) gives exit 1 with exactly 1 failing rule, the rule for that break, and the failure output names the broken file.

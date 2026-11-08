# flake-trap

At 924f822ee0f1bac754fe1e8edbaf89a3328d6a74: `node --test verify/after-verdict-gaps/flake-trap.test.mjs`, 1/1 pass. docs/traps.md, "A red test the PR
did not touch": "A `ci` test outside the PR's change can go red for timing or a race ... Re-run the check once,
saying so on the PR; red again, it is a real failure, fixed in that PR or named as a new item." Red with main's file.

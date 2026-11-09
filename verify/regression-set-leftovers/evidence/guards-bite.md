# guards-bite

Command: node --test verify/regression-set-leftovers/guards-bite.test.mjs

Excerpt: 7 pass at fa9c1957 (32 s). In a lean copy of the head with node_modules linked: unbroken, both guards pass.
lean-clone.test.mjs goes red when leanClone drops '!/bench/', drops '!/tournaments/', clones with --no-tags, or clones
with --single-branch (the copy holds a second branch). setup-skills-switch.test.mjs goes red, on its "with
CCP_SETUP_SKILLS=0" test, when setup.sh's switch never matches (npm ci runs), and on its "without it" test when the
switch always matches (npm ci skipped); setup.sh's change is committed, since the guard runs setup.sh from a clone.

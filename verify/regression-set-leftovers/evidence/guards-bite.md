# guards-bite

Command: node --test verify/regression-set-leftovers/guards-bite.test.mjs

Excerpt: 7 pass at 204ba01e (about 32 s), in this checkout and in a detached depth-1 clone like CI's. In a lean copy of the head with node_modules linked: unbroken, both guards pass.
lean-clone.test.mjs goes red when leanClone drops '!/bench/', drops '!/tournaments/', clones with --no-tags, or clones
with --single-branch (the copy adds no branch of its own; the guard's origin holds two extra since 204ba01e, and
with fa9c1957's guard in the depth-1 clone this case stays green). setup-skills-switch.test.mjs goes red, on its "with
CCP_SETUP_SKILLS=0" test, when setup.sh's switch never matches (npm ci runs), and on its "without it" test when the
switch always matches (npm ci skipped); setup.sh's change is committed, since the guard runs setup.sh from a clone.

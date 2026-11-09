# skills-switch

Command: `node --test verify/fast-test-clones-and-setup/skills-switch.test.mjs` at be40cff22a443e1d5be0f9dd0ac1cce00837e00b.

Excerpt: 2 pass. setup.sh run from a lean clone whose origin is a bare clone of the checkout, CCP_SETUP_REF=HEAD,
CCP_SETUP_LOG set, a temp HOME, the session's CLAUDE*/CCP* names removed, a stub npm first on PATH that records its
folder and arguments and leaves node_modules/.from-stub-npm. With CCP_SETUP_SKILLS=0: the plugin installed, the skill
copied (SKILL.md, package-lock.json), no node_modules, no npm call, log "skill documentation-downloader: npm ci
skipped (CCP_SETUP_SKILLS=0)". Without it: one call, "npm ci --no-audit --no-fund --loglevel=error" in
/tmp/tmp.*/vendor/documentation-downloader (the copy, not the clone), and the installed skill holds that node_modules.

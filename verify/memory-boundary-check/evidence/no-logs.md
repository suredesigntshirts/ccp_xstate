# no-logs

Diffed my listing (`pruned.md`) against snapshot 2 (`2-2026-11-09T1834Z-after-prune.json`) and snapshots 3 and 4 by
name and sha-256. Added: none. Deleted: none. Changed: `MEMORY.md` only (9807264a at snapshot 2, 9b7e5ec3 at
snapshot 3, 956d4f48 at the first verifier's listing, 17ab602d at snapshot 4 and now), the coordinator's index. The
other four files have equal hashes since snapshot 2.

Read `MEMORY.md` in my own folder and ran
`grep -nE '#[0-9]+|\b[0-9a-f]{7,40}\b|\bMET\b|verdict|merged|releas|round' MEMORY.md`. Hits: line 8 (the per-item
flow directive) and line 9 (the latest-release directive with the person's message ids). Read by hand, its state
section names thread ids per item, the held batch and the setup-script thread; one line says earlier verifiers of
this item "landed on 0.1.42 and are resolved", which says which thread is current, not a round account. No PR number,
sha, verdict, merge or release time.

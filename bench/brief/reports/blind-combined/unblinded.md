# blind-combined: the read, unblinded

The reader's verdict per case (read.md), mapped through key.json after the read. A is bench/brief/runs/baseline, B is bench/brief/runs/variant-combined. The packet was read by `claude -p --model claude-opus-5-5 --tools "" --setting-sources ""` started in an empty temp folder.

| Case | Reader chose | Which is |
|---|---|---|
| intake-shared-parser | X | baseline |
| intake-suggested-fix | Even | even |
| planted-after-merge | Y | baseline |
| planted-half-met | Y | baseline |
| planted-missing-line | Even | even |
| planted-prescribed-fix | X | baseline |
| real-adopt-clamp | Y | baseline |
| real-jsonl-lint | X | baseline |
| real-jsonl-lint-multi | Y | baseline |

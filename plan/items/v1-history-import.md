```json
{
  "id": "v1-history-import",
  "title": "Import v1's one history into the v2 journal as labelled rows",
  "stage": "s5-parity",
  "kind": "build",
  "status": "dropped",
  "outcome": "v1's history rows appear in the v2 journal as labelled imported rows, so all work since 26 Oct can be seen in one place.",
  "why": "Dropped 2026-11-11: the person chose not to import v1 into v2 (plan/decisions/2026-11-11-v1-out-of-scope.md). The person wanted one history from the start. Parked until the comparison shows whether seeing v1 work in v2's pages is worth it.",
  "serves": [
    "L-one-history",
    "L-placeholders-labelled"
  ],
  "depends_on": [
    "parity-compare"
  ]
}
```

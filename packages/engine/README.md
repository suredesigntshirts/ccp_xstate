# engine

A workflow file (`workflows/*.json`) loaded into XState (`src/spec.js`, plan item wf-quick-fix), and the host that
drives one item of it from what reaches it from outside (`src/host.js` and `src/wake.js`, plan item engine-host).

- `restore({ root, item, spec, session, release })` rebuilds the item from its one file,
  `<root>/items/<item>.jsonl`, checking every recorded hash.
- `applyEvent(host, { event, source, run?, at? })` offers one event and returns its `engine.transition` row and the
  effects it asks for. `persist(host, rows)` appends rows; `runEffects(host, handlers)` carries out the effects once
  each by effect id. `offer(host, inputs, handlers)` does all three in turn.
- `inputsOfWake(host, text)` turns a wake the platform delivered into those inputs. It is the only place an event's
  source is read, and it reads it from the envelope or the host's own record.

The rows are in `docs/journal.md`, "Engine rows". Why it is shaped this way: `plan/decisions/2026-10-30-engine-host.md`.

`bin/host.js` runs it from a shell or a hook, one item per call:

```
node packages/engine/bin/host.js start --item <id> --workflow quick-fix --input '<json>' --session <id>
node packages/engine/bin/host.js wake --item <id> --workflow quick-fix < <hook input JSON>
node packages/engine/bin/host.js show --item <id> --workflow quick-fix
```

`--root` defaults to `$CCP_JOURNAL_DIR` or `/mnt/project-files/harness/journal`. No effect handlers run yet
(engine-effects and engine-actors add them), so effects stay pending and are printed.

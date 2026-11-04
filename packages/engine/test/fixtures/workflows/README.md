Workflows for the engine's own tests, loaded with `loadWorkflow(name, { dir })`. `timed.json` keeps the host's timer
and tripwire machinery under test now that quick-fix no longer sets a timer or takes a tripwire (lane A of the
2026-11-03 tournament removed both from the workflows; the engine still runs them for any workflow that declares them).

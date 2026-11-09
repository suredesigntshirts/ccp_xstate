#!/usr/bin/env node
// Run by npm before `npm test` (the pretest script): stops at once, with one line, when the workspace's dependencies
// are not installed, rather than letting every test file fail on a module it cannot find.
try {
  import.meta.resolve('xstate');
} catch {
  console.error('npm test: node_modules is not installed here; run npm ci first, then npm test again');
  process.exit(1);
}

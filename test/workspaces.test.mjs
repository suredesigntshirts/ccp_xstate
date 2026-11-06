// The workspace layout: every package under packages/ and plugins/ runs on Node 22+, and depends at runtime only on
// its sibling workspaces and on packages a plan/decisions/ file names on a line `Runtime dependency: \`<name>\``
// (plan item prompt-catalogue; docs/layout.md, Dependencies).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const rootPkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const workspaces = ['packages', 'plugins'].flatMap((dir) => existsSync(join(root, dir))
  ? readdirSync(join(root, dir)).filter((d) => existsSync(join(root, dir, d, 'package.json'))).map((d) => join(dir, d))
  : []);

/** The runtime dependencies plan/decisions/ names: name -> the decision files that name it. */
export function namedDependencies(decisions = join(root, 'plan', 'decisions')) {
  const named = new Map();
  for (const file of readdirSync(decisions).filter((f) => f.endsWith('.md')).sort()) {
    for (const m of readFileSync(join(decisions, file), 'utf8').matchAll(/^Runtime dependency: `([^`\s]+)`/gm)) {
      named.set(m[1], [...(named.get(m[1]) ?? []), file]);
    }
  }
  return named;
}

/** The runtime dependencies of the workspaces that are neither a sibling nor named: [{ workspace, dependency }]. */
export function unnamed(dir = root, decisions = join(dir, 'plan', 'decisions')) {
  const list = ['packages', 'plugins'].flatMap((d) => existsSync(join(dir, d))
    ? readdirSync(join(dir, d)).filter((w) => existsSync(join(dir, d, w, 'package.json'))).map((w) => join(d, w))
    : []);
  const pkgs = list.map((w) => ({ w, pkg: JSON.parse(readFileSync(join(dir, w, 'package.json'), 'utf8')) }));
  const siblings = new Set(pkgs.map(({ pkg }) => pkg.name));
  const named = namedDependencies(decisions);
  return pkgs.flatMap(({ w, pkg }) => Object.keys(pkg.dependencies ?? {})
    .filter((d) => !siblings.has(d) && !named.has(d))
    .map((d) => ({ workspace: w, dependency: d })));
}

test('the root declares the workspaces and Node 22+', () => {
  assert.deepEqual(rootPkg.workspaces, ['packages/*', 'plugins/*']);
  assert.equal(rootPkg.engines.node, '>=22');
  assert.equal(rootPkg.dependencies, undefined);
});

test('every runtime dependency of a workspace is a sibling or named by a plan/decisions/ file', () => {
  assert.deepEqual(unnamed(), [], 'name each one on a line `Runtime dependency: `<name>`` in a plan/decisions/ file');
  assert.equal(workspaces.length > 0, true);
});

test('xstate and mustache are the named runtime dependencies', () => {
  const named = namedDependencies();
  assert.ok(named.has('xstate') && named.has('mustache'), `named: ${[...named.keys()].join(', ')}`);
});

test('a dependency no decision names is caught, and naming it on its own line lets it through', () => {
  const dir = mkdtempSync(join(tmpdir(), 'workspaces-'));
  mkdirSync(join(dir, 'packages', 'a'), { recursive: true });
  mkdirSync(join(dir, 'packages', 'b'), { recursive: true });
  mkdirSync(join(dir, 'plan', 'decisions'), { recursive: true });
  writeFileSync(join(dir, 'packages', 'a', 'package.json'), JSON.stringify({ name: 'a', dependencies: { 'left-pad': '1.3.0', b: '*' } }));
  writeFileSync(join(dir, 'packages', 'b', 'package.json'), JSON.stringify({ name: 'b' }));
  writeFileSync(join(dir, 'plan', 'decisions', 'x.md'), 'We like `left-pad` (mentioned, not named).\n');
  assert.deepEqual(unnamed(dir), [{ workspace: join('packages', 'a'), dependency: 'left-pad' }]);
  writeFileSync(join(dir, 'plan', 'decisions', 'y.md'), 'Runtime dependency: `left-pad`\n');
  assert.deepEqual(unnamed(dir), []);
});

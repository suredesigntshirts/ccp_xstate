// snapshot-detects: the snap() and changed() that no-self-edit.test.mjs uses, lifted from its source (importing the
// file would run its tests), report each mutation by entry and report nothing for a run that only reads.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chmodSync, copyFileSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, symlinkSync, unlinkSync, writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { NO_SELF_EDIT, REPO, temp } from './lib.mjs';

/** The two exported functions of the no-self-edit file, as a module of their own. */
async function detector(dir) {
  const src = readFileSync(join(REPO, NO_SELF_EDIT), 'utf8');
  const fn = (name) => {
    const m = src.match(new RegExp(`^export function ${name}\\([\\s\\S]*?^}$`, 'm'));
    assert.ok(m, `${name} found in ${NO_SELF_EDIT}`);
    return m[0];
  };
  const mod = join(dir, 'detector.mjs');
  writeFileSync(mod, `import { createHash } from 'node:crypto';
import { existsSync, lstatSync, readFileSync, readdirSync, readlinkSync } from 'node:fs';
import { join } from 'node:path';
${fn('snap')}
${fn('changed')}
`);
  return import(pathToFileURL(mod).href);
}

/** A folder with files, a subfolder and a link, at <dir>/w. */
function world(dir) {
  const w = join(dir, 'w');
  mkdirSync(join(w, 'sub'), { recursive: true });
  writeFileSync(join(w, 'a.txt'), 'alpha\n');
  writeFileSync(join(w, 'sub', 'b.txt'), 'bravo\n');
  writeFileSync(join(w, 'c.txt'), 'charlie\n');
  writeFileSync(join(w, 't1'), '1');
  writeFileSync(join(w, 't2'), '2');
  symlinkSync('t1', join(w, 'link'));
  return w;
}

// Timestamps move in clock ticks; a short wait keeps each mutation from landing in the tick the snapshot saw.
const tick = () => new Promise((r) => setTimeout(r, 25));

const MUTATIONS = [
  ['a file created', (w) => writeFileSync(join(w, 'sub', 'new.txt'), 'x'), (w) => join(w, 'sub', 'new.txt')],
  ['a file deleted', (w) => unlinkSync(join(w, 'c.txt')), (w) => join(w, 'c.txt')],
  ['a file\'s content edited', (w) => writeFileSync(join(w, 'a.txt'), 'ALPHA\n'), (w) => join(w, 'a.txt')],
  ['a file rewritten with its old content', (w) => writeFileSync(join(w, 'sub', 'b.txt'), readFileSync(join(w, 'sub', 'b.txt'))), (w) => join(w, 'sub', 'b.txt')],
  ['a mode change', (w) => chmodSync(join(w, 'a.txt'), 0o600), (w) => join(w, 'a.txt')],
  ['an empty folder made', (w) => mkdirSync(join(w, 'sub', 'empty')), (w) => join(w, 'sub', 'empty')],
  ['a symlink retargeted', (w) => { unlinkSync(join(w, 'link')); symlinkSync('t2', join(w, 'link')); }, (w) => join(w, 'link')],
  ['an identical copy moved over a file', (w) => { copyFileSync(join(w, 'c.txt'), join(w, 'c.tmp')); renameSync(join(w, 'c.tmp'), join(w, 'c.txt')); }, (w) => join(w, 'c.txt')],
];

for (const [name, mutate, entry] of MUTATIONS) {
  test(`snapshot-detects: ${name} is reported, naming the entry`, async (t) => {
    const d = temp(t, 'snap');
    const { snap, changed } = await detector(d);
    const w = world(d);
    const before = snap(w);
    await tick();
    mutate(w);
    const diff = changed(before, snap(w));
    t.diagnostic(`${name}: ${JSON.stringify(diff.map((p) => p.slice(w.length)))}`);
    assert.ok(diff.includes(entry(w)), `${entry(w)} named in ${JSON.stringify(diff)}`);
  });
}

test('snapshot-detects: an identical rewrite reported even with no wait before it', async (t) => {
  const d = temp(t, 'snap');
  const { snap, changed } = await detector(d);
  const w = world(d);
  const before = snap(w);
  writeFileSync(join(w, 'a.txt'), 'alpha\n');
  copyFileSync(join(w, 'c.txt'), join(w, 'c.tmp'));
  renameSync(join(w, 'c.tmp'), join(w, 'c.txt'));
  const diff = changed(before, snap(w));
  assert.ok(diff.includes(join(w, 'c.txt')), 'the moved copy (new inode) is seen at once');
});

test('snapshot-detects: a run that only reads the folder reports nothing', async (t) => {
  const d = temp(t, 'snap');
  const { snap, changed } = await detector(d);
  const w = world(d);
  const before = snap(w);
  await tick();
  const walk = (p) => { for (const n of readdirSync(p, { withFileTypes: true })) { const q = join(p, n.name); statSync(q); if (n.isDirectory()) walk(q); else if (n.isFile()) readFileSync(q); } };
  walk(w);
  snap(w);
  assert.deepEqual(changed(before, snap(w)), []);
});

test('snapshot-detects: the root itself is in the snapshot, and deleting a whole folder names its entries', async (t) => {
  const d = temp(t, 'snap');
  const { snap, changed } = await detector(d);
  const w = world(d);
  const before = snap(w);
  assert.ok(w in before, 'the watched folder is an entry');
  await tick();
  rmSync(join(w, 'sub'), { recursive: true });
  const diff = changed(before, snap(w));
  assert.ok(diff.includes(join(w, 'sub')) && diff.includes(join(w, 'sub', 'b.txt')) && diff.includes(w));
});

#!/usr/bin/env node
// The guard files a change can reach. A guard reaches a file when the file is in the guard's reach: the guard itself,
// every module it imports, every repo path it names (a quoted path, a join() of quoted parts, or a new URL beside it),
// and, for each of those that is code, its own reach in turn. A named folder reaches every file under it.
// A change to a file every guard shares, or to a file no guard reaches outside the folders no guard needs, selects all.
//
//   node scripts/ci/select-tests.mjs [--base <rev>] [--head <rev>] [--explain]
//   prints the selected guard files, one per line, or ALL; --explain adds the reason for each to stderr.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, normalize, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO = resolve(join(dirname(fileURLToPath(import.meta.url)), '..', '..'));

/** The guard trees and each one's test file names, as npm test's parallel pass globs them. */
const GUARD = /^(test|scripts)\/.*\.test\.mjs$|^(packages|plugins)\/.*\.test\.(js|mjs)$/;
/** Files every guard depends on: a change to one runs them all. */
export const SHARED = [
  'package.json', 'package-lock.json', '.github/workflows/ci.yml', 'scripts/ci/select-tests.mjs', 'scripts/ci/pr-tests.mjs',
];
/** Folders whose files no guard needs unless one names them; an unreached file here selects nothing. */
export const INERT = ['plan/', 'docs/', 'bench/', 'tournaments/', 'verify/', 'probes/'];

const CODE = /\.(m|c)?js$/;
const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', maxBuffer: 1 << 28 });

/** Every tracked path, and the paths in `also`, and every folder holding one. */
function tracked(repo, also = []) {
  const files = [...git(repo, 'ls-files', '-z').split('\0').filter(Boolean), ...also];
  const dirs = new Set();
  for (const f of files) for (let d = dirname(f); d !== '.'; d = dirname(d)) dirs.add(d);
  return { files: new Set(files), dirs };
}

/**
 * The strings in `src` that can name a repo path: a quoted string holding a '/' or a '.', a bare word inside a join(...)
 * (joined with the parts after it) or in an array of strings on a line that builds paths. A bare word elsewhere
 * ('plan' in cmd === 'plan', 'verify' in a list of stage names) is not read as a path.
 */
function literals(src) {
  const out = new Set();
  for (const m of src.matchAll(/(['"`])((?:(?!\1)[^\\\n$]|\\.)*)\1/g)) if (/[/.]/.test(m[2])) out.add(m[2]);
  // An array of bare words names paths only on a line that builds paths from it (['plan', 'scripts'] fed to join).
  for (const line of src.split('\n').filter((l) => /\bjoin\(|\bREPO\b|\broot\b/.test(l))) {
    for (const m of line.matchAll(/\[\s*(?:(['"])[^'"\n]*\1\s*,\s*)*(['"])[^'"\n]*\2\s*,?\s*\]/g)) {
      for (const w of m[0].matchAll(/(['"])([^'"\n]*)\1/g)) out.add(w[2]);
    }
  }
  for (const m of src.matchAll(/join\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    const parts = [...m[1].matchAll(/(['"`])([^'"`\n$]*)\1/g)].map((p) => p[2]);
    for (let i = 0; i < parts.length; i++) out.add(parts.slice(i).join('/'));
  }
  return out;
}

/** The repo paths, files or folders, that literal `s` in `file` can name. */
function pathsOf(s, file, { files, dirs }) {
  const out = [];
  const clean = s.replace(/^\.\//, '').replace(/\/+$/, '');
  if (!clean || clean === '.' || clean.length < 2) return out;
  const tryPath = (p) => { if (p && !p.startsWith('..') && (files.has(p) || dirs.has(p))) out.push(p); };
  tryPath(normalize(clean));
  if (s.startsWith('.')) tryPath(normalize(join(dirname(file), s)).replace(/\/+$/, ''));
  for (const ext of ['.js', '.mjs']) if (!CODE.test(clean)) tryPath(normalize(join(dirname(file), s)) + ext);
  return [...new Set(out)];
}

/**
 * Each guard file's reach: the set of repo paths (files and folders) it can read, run or import. Paths in `also` count
 * as tracked, so a file the change deletes still resolves where a guard names it.
 */
export function reaches(repo = REPO, { also = [] } = {}) {
  const t = tracked(repo, also);
  const memo = new Map();
  const direct = (file) => {
    if (memo.has(file)) return memo.get(file);
    let src = '';
    try { src = readFileSync(join(repo, file), 'utf8'); } catch { /* deleted or unreadable */ }
    const named = new Set();
    for (const s of literals(src)) for (const p of pathsOf(s, file, t)) named.add(p);
    memo.set(file, named);
    return named;
  };
  const reachOf = (guard) => {
    const seen = new Set([guard]);
    const queue = [guard];
    while (queue.length) {
      const f = queue.shift();
      if (!CODE.test(f) || !t.files.has(f)) continue;
      for (const p of direct(f)) {
        if (seen.has(p)) continue;
        seen.add(p);
        if (t.files.has(p)) queue.push(p);
        else if (t.dirs.has(p) && /^(packages|plugins|scripts)\/[^/]+(\/src)?$/.test(p)) {
          // A named package folder is its code: follow the code under it.
          for (const g of t.files) if (g.startsWith(`${p}/`) && CODE.test(g) && !GUARD.test(g) && !seen.has(g)) { seen.add(g); queue.push(g); }
        }
      }
    }
    return seen;
  };
  const guards = [...t.files].filter((f) => GUARD.test(f) && !f.split('/').includes('node_modules')).sort();
  return { guards, reach: new Map(guards.map((g) => [g, reachOf(g)])) };
}

/** True when `reach` holds `file` or a folder above it. */
const holds = (reach, file) => {
  if (reach.has(file)) return true;
  for (let d = dirname(file); d !== '.'; d = dirname(d)) if (reach.has(d)) return true;
  return false;
};

/**
 * The guards to run for `changed` repo paths: { all: true, why } or { all: false, files: [{ file, why }] }.
 */
export function select(changed, { repo = REPO, graph = reaches(repo, { also: changed }) } = {}) {
  const { guards, reach } = graph;
  const shared = changed.filter((f) => SHARED.includes(f));
  if (shared.length) return { all: true, why: `shared file changed: ${shared.join(', ')}` };
  const picked = new Map();
  const unplaced = [];
  for (const f of changed) {
    const by = guards.filter((g) => holds(reach.get(g), f));
    for (const g of by) if (!picked.has(g)) picked.set(g, f);
    if (!by.length && !INERT.some((d) => f.startsWith(d)) && !GUARD.test(f)) unplaced.push(f);
  }
  if (unplaced.length) return { all: true, why: `no guard reaches ${unplaced.join(', ')}` };
  return { all: false, files: [...picked].map(([file, why]) => ({ file, why })).sort((a, b) => a.file.localeCompare(b.file)) };
}

/** The repo paths changed between `base` and `head`. */
export const changedFiles = (base, head, repo = REPO) => git(repo, 'diff', '--name-only', '--no-renames', base, head).split('\n').filter(Boolean);

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n, d) => { const i = process.argv.indexOf(`--${n}`); return i > 0 ? process.argv[i + 1] : d; };
  const r = select(changedFiles(arg('base', 'HEAD^1'), arg('head', 'HEAD')));
  if (r.all) {
    console.log('ALL');
    if (process.argv.includes('--explain')) console.error(r.why);
  } else {
    for (const { file, why } of r.files) {
      console.log(file);
      if (process.argv.includes('--explain')) console.error(`${file} <- ${why}`);
    }
  }
}

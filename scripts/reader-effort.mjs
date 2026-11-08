#!/usr/bin/env node
// What a change costs its reader, read from git: the files it touched, the exports it added and removed, the lines a
// reader opens to follow it (its changed hunks plus the top-level definitions they call), and its added and removed
// lines by category. The rules are plan/decisions/2026-11-08-plan-reader-effort.md.
//
//   node scripts/reader-effort.mjs <pr-number | base..head> [--json]
//
// A PR number names the merge commit titled "Merge pull request #<n> " reachable from HEAD; the change is the merge
// against its first parent. A range is read as a PR would be, from the merge base of base and head. --json prints the object a done item's reader_effort field holds.
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const CATEGORIES = ['code', 'tests', 'verifier', 'evidence', 'docs'];
const JS = /\.m?js$/;

// The category a changed path falls in: the first rule it matches.
export function category(path) {
  if (path.startsWith('verify/')) return JS.test(path) ? 'verifier' : 'evidence';
  if (/\.test\.m?js$/.test(path) || /(^|\/)(test|fixtures)\//.test(path)) return 'tests';
  if (path.endsWith('.md') && !path.startsWith('workflows/') && path !== 'packages/engine/messages.md') return 'docs';
  return 'code';
}

// The names a JavaScript file exports.
export function exportsOf(text) {
  const names = new Set();
  for (const line of (text ?? '').split('\n')) {
    let m;
    if ((m = line.match(/^export\s+(?:async\s+)?(?:function\*?|const|let|var|class)\s+([A-Za-z_$][\w$]*)/))) names.add(m[1]);
    else if (/^export\s+default\b/.test(line)) names.add('default');
    else if ((m = line.match(/^export\s*\{([^}]*)\}/)))
      for (const part of m[1].split(',')) {
        const name = part.trim().split(/\s+as\s+/).pop().trim();
        if (name) names.add(name);
      }
  }
  return names;
}

// Top-level definitions in a file: name, first line (1-based) and line count. A definition is `function name(` or
// `const name =` in column 0, optionally exported; it ends at the first `}` in column 0, or on its own line when that
// line closes it.
export function definitionsOf(text) {
  const lines = (text ?? '').split('\n');
  const defs = [];
  const DEF = /^(?:export\s+)?(?:async\s+)?(?:function\*?\s+([A-Za-z_$][\w$]*)\s*\(|const\s+([A-Za-z_$][\w$]*)\s*=)/;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(DEF);
    if (!m) continue;
    const opens = (lines[i].match(/[{(\[]/g) ?? []).length;
    const closes = (lines[i].match(/[})\]]/g) ?? []).length;
    let end = i;
    if (opens > closes) {
      end = lines.findIndex((l, j) => j > i && /^[}\])]/.test(l));
      if (end < 0) end = i;
    }
    defs.push({ name: m[1] ?? m[2], start: i + 1, lines: end - i + 1 });
  }
  return defs;
}

const KEYWORDS = new Set(['if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'typeof', 'new', 'await', 'import', 'super']);
const calls = (line) => [...line.matchAll(/(?<![\w$.])([A-Za-z_$][\w$]*)\s*\(/g)].map((m) => m[1]).filter((n) => !KEYWORDS.has(n));

function git(cwd, args) {
  return execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] });
}
const show = (cwd, rev, path) => { try { return git(cwd, ['show', `${rev}:${path}`]); } catch { return null; } };

// The range of a merged PR: the first parent of the merge commit titled "Merge pull request #<n> ", to that merge.
export function prRange(cwd, pr) {
  const sha = git(cwd, ['log', '--merges', '--format=%H', '-F', `--grep=Merge pull request #${pr} `, 'HEAD']).split('\n')[0];
  if (!sha) throw new Error(`no merge commit for PR #${pr} reachable from HEAD`);
  return { base: git(cwd, ['rev-parse', `${sha}^1`]).trim(), head: sha };
}

// The added line numbers (in the head) of each changed file, from a zero-context diff.
function addedLines(cwd, base, head) {
  const out = new Map();
  let file = null;
  for (const line of git(cwd, ['diff', '--no-renames', '-U0', `${base}...${head}`]).split('\n')) {
    let m;
    if ((m = line.match(/^\+\+\+ (?:b\/(.*)|\/dev\/null)$/))) { file = m[1] ?? null; if (file) out.set(file, new Map()); }
    else if ((m = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/)) && file) {
      out.get(file).cursor = Number(m[1]);
    } else if (file && line.startsWith('+') && !line.startsWith('+++')) {
      const lines = out.get(file);
      lines.set(lines.cursor, line.slice(1));
      lines.cursor++;
    }
  }
  return out;
}

export function report(cwd, { base, head, pr }) {
  const added = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const removed = Object.fromEntries(CATEGORIES.map((c) => [c, 0]));
  const paths = [];
  for (const row of git(cwd, ['diff', '--no-renames', '--numstat', `${base}...${head}`]).split('\n').filter(Boolean)) {
    const [a, r, path] = row.split('\t');
    const c = category(path);
    paths.push(path);
    added[c] += a === '-' ? 0 : Number(a);
    removed[c] += r === '-' ? 0 : Number(r);
  }

  let exportsAdded = 0;
  let exportsRemoved = 0;
  for (const path of paths.filter((p) => JS.test(p) && category(p) === 'code')) {
    const before = exportsOf(show(cwd, base, path));
    const after = exportsOf(show(cwd, head, path));
    for (const n of after) if (!before.has(n)) exportsAdded++;
    for (const n of before) if (!after.has(n)) exportsRemoved++;
  }

  // The definitions a changed line calls, counted once each; a definition whose first line the change added is
  // already in the hunks.
  const hunks = addedLines(cwd, base, head);
  const defs = new Map();
  for (const path of git(cwd, ['ls-tree', '-r', '--name-only', head]).split('\n').filter((p) => JS.test(p))) {
    const text = show(cwd, head, path);
    const exported = exportsOf(text);
    for (const d of definitionsOf(text)) {
      if (hunks.get(path)?.has(d.start)) continue;
      if (!defs.has(d.name)) defs.set(d.name, []);
      defs.get(d.name).push({ ...d, path, exported: exported.has(d.name) });
    }
  }
  const opened = new Set();
  let definitionLines = 0;
  for (const [path, lines] of hunks) {
    if (!JS.test(path) || category(path) === 'evidence') continue;
    for (const name of new Set([...lines.values()].flatMap(calls))) {
      // A call reads the definition in its own file if there is one, else the exported ones elsewhere.
      const all = defs.get(name) ?? [];
      const own = all.filter((d) => d.path === path);
      for (const d of own.length ? own : all.filter((d) => d.exported)) {
        const key = `${d.path}:${d.start}`;
        if (opened.has(key)) continue;
        opened.add(key);
        definitionLines += d.lines;
      }
    }
  }
  const hunkLines = CATEGORIES.filter((c) => c !== 'evidence').reduce((n, c) => n + added[c] + removed[c], 0);

  return {
    ...(pr === undefined ? {} : { pr }),
    files: paths.length,
    exports_added: exportsAdded,
    exports_removed: exportsRemoved,
    reader_lines: hunkLines + definitionLines,
    added,
    removed,
  };
}

function text(r, range) {
  const row = (label, o) => `  ${label.padEnd(9)} ${CATEGORIES.map((c) => `${c} ${o[c]}`).join(', ')}`;
  return [
    `${r.pr === undefined ? range : `PR #${r.pr}`}: ${r.files} files, exports +${r.exports_added} -${r.exports_removed}, ` +
      `${r.reader_lines} reader lines`,
    row('added', r.added),
    row('removed', r.removed),
  ].join('\n');
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const arg = process.argv.slice(2).find((a) => !a.startsWith('--'));
  const cwd = process.cwd();
  if (!arg) {
    console.error('usage: node scripts/reader-effort.mjs <pr-number | base..head> [--json]');
    process.exit(2);
  }
  try {
    const pr = /^#?\d+$/.test(arg) ? Number(arg.replace('#', '')) : undefined;
    const [base, head] = pr === undefined ? arg.split('..') : [];
    const range = pr === undefined ? { base, head, pr } : { ...prRange(cwd, pr), pr };
    const r = report(cwd, range);
    console.log(process.argv.includes('--json') ? JSON.stringify(r, null, 2) : text(r, arg));
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

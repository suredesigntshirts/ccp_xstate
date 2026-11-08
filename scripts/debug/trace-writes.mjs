#!/usr/bin/env node
// Runs a command under strace -f and prints each write-like syscall, by it or any child, whose path falls under a
// folder. For seeing which process wrote what; the tests prove "nothing was written" with a snapshot instead.
//
//   node scripts/debug/trace-writes.mjs <folder> [--keep <trace-file>] -- <command> [args...]
//
// Relative paths are resolved against each process's working directory (followed through chdir and fork) or the
// directory fd strace names (-y). The trace is written to a temp file and removed unless --keep names where to put it.
// Exits with the command's status; 127 when strace is missing.
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, renameSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isAbsolute, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WRITEY = new Set(['open', 'openat', 'openat2', 'creat', 'mkdir', 'mkdirat', 'rename', 'renameat', 'renameat2', 'unlink',
  'unlinkat', 'rmdir', 'symlink', 'symlinkat', 'link', 'linkat', 'truncate', 'chmod', 'fchmodat', 'chown', 'fchownat',
  'lchown', 'utimensat', 'utimes', 'setxattr', 'lsetxattr', 'removexattr', 'mknod', 'mknodat']);
const OPEN = new Set(['open', 'openat', 'openat2']);

/** The write-like calls in a strace -f -y trace whose path is under `root`, as { pid, call, path, line }. */
export function writesUnder(trace, root, startCwd) {
  root = resolve(root);
  const cwd = new Map();
  const pending = new Map();
  const hits = [];
  const under = (p) => p === root || p.startsWith(root + '/');
  for (let line of trace.split('\n')) {
    const m0 = line.match(/^(\d+)\s+(.*)$/);
    if (!m0) continue;
    const pid = m0[1];
    let body = m0[2];
    if (body.endsWith('<unfinished ...>')) { pending.set(pid, body.slice(0, -'<unfinished ...>'.length)); continue; }
    const res = body.match(/^<\.\.\. \w+ resumed>(.*)$/);
    if (res) { body = (pending.get(pid) ?? '') + res[1]; pending.delete(pid); }
    if (!cwd.has(pid)) cwd.set(pid, startCwd);
    const m = body.match(/^(\w+)\((.*)\)\s+=\s+(-?\d+)/);
    if (!m) continue;
    const [, call, args, ret] = m;
    const here = cwd.get(pid);
    if (['clone', 'clone3', 'fork', 'vfork'].includes(call) && Number(ret) > 0) { cwd.set(ret, here); continue; }
    if (Number(ret) < 0) continue;
    if (call === 'chdir') { const p = args.match(/^"([^"]*)"/); if (p) cwd.set(pid, resolve(here, p[1])); continue; }
    if (call === 'fchdir') { const p = args.match(/^\d+<([^>]*)>/); if (p) cwd.set(pid, p[1]); continue; }
    if (!WRITEY.has(call)) continue;
    if (OPEN.has(call) && !/O_WRONLY|O_RDWR|O_CREAT|O_TRUNC/.test(args)) continue;
    // Each path argument, resolved against the dirfd just before it (shown by -y as N</dir>) or the cwd.
    const paths = [];
    const re = /(?:(AT_FDCWD|\d+<([^>]*)>),\s*)?"([^"]*)"/g;
    for (const a of args.matchAll(re)) {
      const base = a[2] ?? here;
      paths.push(isAbsolute(a[3]) ? a[3] : resolve(base, a[3]));
    }
    // An open returns its fd decorated with the absolute path it reached.
    const opened = body.match(/=\s+\d+<([^>]*)>/);
    if (opened) paths.push(opened[1]);
    const path = paths.find(under);
    if (path) hits.push({ pid: Number(pid), call, path, line: `${pid} ${body}`.trim() });
  }
  return hits;
}

function main(argv) {
  const dash = argv.indexOf('--');
  const opts = dash < 0 ? argv : argv.slice(0, dash);
  const cmd = dash < 0 ? [] : argv.slice(dash + 1);
  const keepAt = opts.indexOf('--keep');
  const keep = keepAt >= 0 ? opts[keepAt + 1] : null;
  const folder = opts.filter((_, i) => keepAt < 0 || (i !== keepAt && i !== keepAt + 1))[0];
  if (!folder || cmd.length === 0) {
    process.stderr.write('usage: node scripts/debug/trace-writes.mjs <folder> [--keep <trace-file>] -- <command> [args...]\n');
    return 2;
  }
  if (spawnSync('strace', ['-V']).status !== 0) {
    process.stderr.write('trace-writes needs strace on PATH (apt-get install strace)\n');
    return 127;
  }
  const dir = mkdtempSync(join(tmpdir(), 'trace-writes-'));
  const file = join(dir, 'trace');
  try {
    const r = spawnSync('strace', ['-f', '-qq', '-y', '-s', '4096', '-o', file, '-e', 'trace=file,desc,process', ...cmd], { stdio: 'inherit' });
    const hits = writesUnder(readFileSync(file, 'utf8'), folder, process.cwd());
    for (const h of hits) process.stdout.write(`${h.pid} ${h.call} ${h.path}\n`);
    process.stderr.write(`${hits.length} write-like call(s) under ${resolve(folder)}\n`);
    if (keep) renameSync(file, resolve(keep));
    return r.status ?? 1;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) process.exitCode = main(process.argv.slice(2));

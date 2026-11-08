#!/usr/bin/env node
// Workflow Inspector build: many sources -> one folder with index.html (page.html, unchanged) and data.js (every run
// as a bundle from export.mjs). A source is a journal root (a real run) or a lane scenario test, which this script
// runs with TMPDIR pointed at a capture folder so the journal roots the test makes are kept; the test itself is not
// changed. Usage: docs/inspector.md.
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { composedIn, exportRoot, graphOf } from './export.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '../..');

/**
 * A source's engine checkout. A string is a folder, relative to this repo's root (so "." is this checkout). An object
 * { commit } is this repo at that commit, checked out once per build as a worktree under the capture folder with this
 * checkout's node_modules linked in: how a journal made before a format change is replayed on the engine that made it.
 * Returns { path } or { missing } naming why there is none.
 */
export function engineOf(engine, captureDir, made = new Map()) {
  if (typeof engine === 'string') return { path: resolve(REPO, engine) };
  const commit = engine?.commit;
  if (!commit) return { missing: `engine ${JSON.stringify(engine)} is neither a folder nor { commit }` };
  if (made.has(commit)) return made.get(commit);
  let out;
  try {
    execFileSync('git', ['-C', REPO, 'cat-file', '-e', `${commit}^{commit}`], { stdio: 'ignore' });
    const dir = join(captureDir, `engine-${commit.slice(0, 12)}`);
    if (!existsSync(join(dir, 'packages'))) {
      rmSync(dir, { recursive: true, force: true });
      execFileSync('git', ['-C', REPO, 'worktree', 'prune'], { stdio: 'ignore' });
      execFileSync('git', ['-C', REPO, 'worktree', 'add', '-q', '--detach', dir, commit], { stdio: 'ignore' });
      if (existsSync(join(REPO, 'node_modules'))) symlinkSync(join(REPO, 'node_modules'), join(dir, 'node_modules'));
    }
    out = { path: dir, commit };
  } catch {
    out = { missing: `commit ${commit} is not in this clone (a shallow clone lacks it: git fetch --unshallow)` };
  }
  made.set(commit, out);
  return out;
}
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** The leading // comment of a test file, as one paragraph: the scenario's own description. */
export const scenarioText = (file) => {
  const lines = (existsSync(file) ? readFileSync(file, 'utf8') : '').split('\n');
  const out = [];
  for (const l of lines) { if (/^\s*\/\//.test(l)) out.push(l.replace(/^\s*\/\/\s?/, '')); else break; }
  return out.join(' ').trim() || null;
};

/** Top-level test names, in order, from TAP output. */
export const testNames = (tap) => tap.split('\n').filter((l) => /^# Subtest: /.test(l)).map((l) => l.slice(10).trim());

// Every folder under dir (two levels) that holds items/*.jsonl: a journal root.
const rootsIn = (dir) => {
  const out = [];
  const look = (d, depth) => {
    if (!existsSync(d) || !statSync(d).isDirectory()) return;
    if (existsSync(join(d, 'items')) && readdirSync(join(d, 'items')).some((n) => n.endsWith('.jsonl'))) { out.push(d); return; }
    if (depth < 2) for (const n of readdirSync(d)) look(join(d, n), depth + 1);
  };
  look(dir, 0);
  // Order by the time of each root's first journal row: the order the tests made them in.
  const firstAt = (root) => readdirSync(join(root, 'items')).filter((n) => n.endsWith('.jsonl'))
    .map((n) => { try { return JSON.parse(readFileSync(join(root, 'items', n), 'utf8').split('\n')[0]).at; } catch { return '9'; } }).sort()[0] ?? '9';
  return out.map((r) => [r, firstAt(r)]).sort((a, b) => a[1].localeCompare(b[1])).map(([r]) => r);
};

/** Run one scenario test of a lane checkout, keeping the journal roots it makes. Returns { roots, names, ok, log }. */
export function capture({ engine, scenario, dir }) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  let log = '', ok = true;
  // A test runner sets NODE_TEST_CONTEXT for its children; a nested `node --test` would then report to it, not run.
  const { NODE_TEST_CONTEXT, ...env } = process.env;
  try {
    log = execFileSync(process.execPath, ['--test', '--test-reporter=tap', scenario], {
      cwd: engine, env: { ...env, TMPDIR: dir, TMP: dir, TEMP: dir }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000
    });
  } catch (error) {
    ok = false;
    log = String(error.stdout ?? '') + String(error.stderr ?? '');
  }
  return { roots: rootsIn(dir), names: testNames(log), ok, log };
}

// The name sources.json gives an engine in `engines`: keyed by the folder as written, or by "commit:<sha>".
const engineName = (conf, src) => {
  if (!src || !conf.engines) return null;
  const key = typeof src.engine === 'string' ? src.engine : `commit:${src.engine?.commit}`;
  return conf.engines[key] ?? conf.engines[src.enginePath] ?? null;
};

export async function build({ config, out, captureDir }) {
  const conf = JSON.parse(readFileSync(config, 'utf8'));
  const runs = [], skipped = [], made = new Map();
  mkdirSync(captureDir, { recursive: true });
  for (const src of conf.sources) {
    const eng = engineOf(src.engine, captureDir, made);
    if (eng.missing) { skipped.push(`${src.label}: ${eng.missing}`); continue; }
    const engine = eng.path;
    src.enginePath = engine;
    if (!existsSync(engine)) { skipped.push(`${src.label}: no engine checkout at ${engine}`); continue; }
    if (src.scenario) {
      const file = join(engine, src.scenario);
      if (!existsSync(file)) { skipped.push(`${src.label}: no scenario test at ${file}`); continue; }
      const dir = join(captureDir, slug(`${src.origin}-${basename(src.scenario)}`));
      const cap = capture({ engine, scenario: src.scenario, dir });
      if (!cap.roots.length) { skipped.push(`${src.label}: the test made no journal root (${cap.ok ? 'passed' : 'failed'})`); continue; }
      const about = scenarioText(file);
      for (const [i, root] of cap.roots.entries()) {
        const name = cap.roots.length === cap.names.length ? cap.names[i] : null;
        const shortName = name ? (name.length > 60 ? `${name.slice(0, 58)}…` : name) : null;
        const label = `${src.label}${cap.roots.length > 1 ? ` · test ${i + 1} of ${cap.roots.length}${shortName ? `: ${shortName}` : ''}` : ''}`;
        const note = `Scripted scenario (${src.scenario}${cap.ok ? '' : ', and the test FAILED'}): the agents here are test fixtures (their briefs and results are written in the test), GitHub is a fake local server, and no model ran.` +
          (name ? ` Test: "${name}".` : cap.roots.length > 1 ? ' The test file made several journals; their test names could not be matched.' : '') + (about ? ` Scenario: ${about}` : '');
        let bundles;
        try { bundles = await exportRoot({ engine, journal: root, kind: 'scripted', label, origin: src.origin, note, id: slug(`${src.origin}-${basename(src.scenario, '.test.js')}-${i + 1}`) }); }
        catch (error) { skipped.push(`${label}: ${error.message}`); continue; }
        bundles.forEach((b) => { b.scenario = { file: src.scenario, test: name, about, passed: cap.ok }; });
        runs.push(...bundles);
      }
    } else {
      const journal = resolve(REPO, src.journal);
      if (!existsSync(join(journal, 'items'))) { skipped.push(`${src.label}: no items/ under ${journal}`); continue; }
      let bundles;
      try { bundles = await exportRoot({ engine, journal, workflow: src.workflow ?? null, kind: src.kind ?? 'real', label: src.label, origin: src.origin, note: src.note ?? null, id: slug(`${src.origin}-${src.label}`) }); }
      catch (error) { skipped.push(`${src.label}: ${error.message}`); continue; }
      runs.push(...bundles);
    }
  }
  // One copy of each workflow: runs point at it by hash.
  const workflows = {};
  for (const r of runs) {
    const key = r.workflow.sha256 ?? r.id;
    workflows[key] ??= { name: r.workflow.name, spec: r.workflow.spec, graph: r.graph };
    delete r.workflow.spec;
    delete r.graph;
    r.workflow.key = key;
  }
  // Every workflow file of every engine checkout named in the sources, shown even when no run of it was captured.
  const shelf = [];
  const seenEngines = [...new Set(conf.sources.map((s) => s.enginePath).filter((e) => e && existsSync(join(e, 'workflows'))))];
  for (const engine of seenEngines) {
    const who = conf.sources.find((s) => s.enginePath === engine);
    const owner = engineName(conf, who) ?? String(who.origin).replace(/\s*\((?:scripted|main engine)\)\s*$/i, '').replace(/^Real runs$/i, 'Main');
    for (const file of readdirSync(join(engine, 'workflows')).filter((n) => n.endsWith('.json')).sort()) {
      const path = join(engine, 'workflows', file);
      const text = readFileSync(path, 'utf8');
      let spec; try { spec = JSON.parse(text); } catch { skipped.push(`${path}: not JSON`); continue; }
      let key = createHash('sha256').update(text).digest('hex');
      // A workflow with stage files is keyed and shown as its engine pins it: filled in from them.
      try {
        const read = await composedIn(engine, basename(file, '.json'));
        if (read && read.spec !== read.raw) { spec = read.spec; key = createHash('sha256').update(read.bytes).digest('hex'); }
      } catch (error) { skipped.push(`${path}: ${error.message}`); continue; }
      const used = runs.filter((r) => r.workflow.key === key);
      if (!workflows[key]) {
        try { workflows[key] = { name: basename(file, '.json'), spec, graph: await graphOf(engine, spec) }; }
        catch (error) { skipped.push(`${path}: ${error.message}`); continue; }
      }
      shelf.push({ id: slug(`wf-${owner}-${file}`), key, file: path, engine, label: `${owner} · ${file}`, runs: used.map((r) => r.id) });
    }
  }
  for (const r of runs) {
    const e = r.engine.path;
    r.engineLabel = engineName(conf, conf.sources.find((s) => s.enginePath === e)) ?? shelf.find((x) => x.engine === e)?.label.split(' · ')[0] ?? null;
  }
  mkdirSync(out, { recursive: true });
  const data = { generated: new Date().toISOString(), skipped, runs, workflows, shelf };
  writeFileSync(join(out, 'data.js'), `window.INSPECTOR_DATA = ${JSON.stringify(data)};\n`);
  copyFileSync(join(HERE, 'page.html'), join(out, 'index.html'));
  return { runs: runs.length, skipped, bytes: statSync(join(out, 'data.js')).size };
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const opt = {};
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i += 2) opt[argv[i].replace(/^--/, '')] = argv[i + 1];
  const config = resolve(opt.config ?? join(HERE, 'sources.json'));
  const out = resolve(opt.out ?? '/home/user/inspector-out');
  const captureDir = resolve(opt.capture ?? join(tmpdir(), 'workflow-inspector-capture'));
  const r = await build({ config, out, captureDir });
  console.log(`${r.runs} runs -> ${out} (data.js ${(r.bytes / 1024).toFixed(0)} KB)`);
  for (const s of r.skipped) console.log(`skipped: ${s}`);
}

#!/usr/bin/env node
// Run one model stage alone, k times per case, with the exact prompt the engine renders (plan item stage-bench).
//
//   node scripts/bench/run.mjs --stage brief --out <dir> [--case <id,id|all>] [--k 3] [--workflow <file> | --rev <git rev>]
//                              [--model <id>] [--parallel 3] [--force]
//   node scripts/bench/run.mjs --stage <stage> --prompt-only [--case <id> | --input <input.json|run.json>] [--run-id <item:n.name>]
//                              [--workflow <file> | --rev <rev>] [--out <dir>]
//
// Each run is a folder <out>/<case>.<k>/ that is a journal root (items/<item>.jsonl, the run folder
// items/<item>/runs/<n>.<stage>/ with brief.md, context.md, stage.json, run.json and result.json, blobs/), so
// scripts/inspector/build.mjs shows it, plus bench.json (time, tokens, model, workflow version, ambient, returns),
// transcript.jsonl (the session cut down) and, after score.mjs, judge/ and score.json. The session is Claude Code
// headless (`claude -p`, or $BENCH_CLAUDE), started in the run's worktree with the prompt on stdin, the run's context
// appended to its system prompt, and one MCP server, `harness`, whose `return` tool calls the engine's accept(). It
// has no GitHub: nothing here reads a token or calls github.com. docs/prompts.md has the procedure.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import {
  RELEASE, SESSION, ambientOf, benchEnv, caseRepo, casesOf, claudeBin, prepareRun, readJson, runClaude, sha256, specOf, startAgent,
  streamRows, tokensOf, transcriptOf, trimTranscript, workflowVersion, writeJson
} from './lib.mjs';

const SERVER = fileURLToPath(new URL('./return-server.mjs', import.meta.url));
/** The tools a bench session may use without asking: what a stage agent uses, and the return tool. */
export const TOOLS = ['Bash', 'Read', 'Glob', 'Grep', 'LS', 'Write', 'Edit', 'ToolSearch', 'mcp__harness__return'];
const safe = (s) => String(s).replace(/[^A-Za-z0-9-]/g, '-');

/** The claude arguments for one bench session. */
export const sessionArgs = ({ context, mcpFile, model }) => [
  '-p', '--output-format', 'stream-json', '--verbose',
  '--append-system-prompt', context,
  '--mcp-config', mcpFile, '--strict-mcp-config',
  '--setting-sources', 'project,local',
  '--allowedTools', ...TOOLS,
  ...(model ? ['--model', model] : [])
];

/** One bench run of a case: prepare with the engine, run the session, record. Returns bench.json's value. */
export async function benchRun({ c, k, stage, version, out, model = null, force = false, log = () => {} }) {
  const dir = join(out, `${c.id}.${k}`);
  if (existsSync(dir)) {
    if (!force) throw new Error(`${dir} exists: pick another --out, or --force to replace it`);
    rmSync(dir, { recursive: true, force: true });
  }
  const work = mkdtempSync(join(tmpdir(), `bench-${safe(c.id)}-${k}-`));
  try {
    const repo = caseRepo(c, work);
    const spec = specOf(version, dir);
    const item = safe(`${c.id}-${k}`);
    const prepared = await prepareRun({ spec, actor: stage, item, root: dir, repo, worktrees: join(work, 'wt'), caseInput: c.input });
    const agentId = `bench-${item}`;
    const started = startAgent({ root: dir, run: prepared.run, agentId });
    if (started.prompt !== prepared.prompt) throw new Error('spawn() handed out a prompt other than brief.md');
    const runJson = readJson(join(prepared.dir, 'run.json'));
    const mcpFile = join(work, 'mcp.json');
    writeJson(mcpFile, { mcpServers: { harness: { type: 'stdio', command: process.execPath, args: [SERVER], env: { BENCH_ROOT: resolve(dir), BENCH_RUN: prepared.run, BENCH_AGENT: agentId } } } });
    const sent = readFileSync(join(prepared.dir, 'brief.md'));
    log(`${c.id}.${k}: running ${prepared.run} in ${runJson.worktree}`);
    const t0 = new Date().toISOString();
    const got = await runClaude({ args: sessionArgs({ context: started.context, mcpFile, model }), prompt: sent, cwd: runJson.worktree });
    const rows = streamRows(got.stdout);
    const init = rows.find((r) => r.type === 'system' && r.subtype === 'init') ?? {};
    const result = rows.findLast((r) => r.type === 'result') ?? {};
    const transcript = init.session_id ? transcriptOf(runJson.worktree, init.session_id) : null;
    const ambient = ambientOf(transcript ? readFileSync(transcript, 'utf8') : '');
    let systemPrompt = null;
    if (ambient.systemPrompt) {
      const h = sha256(ambient.systemPrompt);
      const f = join(out, 'system-prompts', `${h}.txt`);
      mkdirSync(join(out, 'system-prompts'), { recursive: true });
      if (!existsSync(f)) writeFileSync(f, ambient.systemPrompt);
      systemPrompt = { sha256: h, bytes: Buffer.byteLength(ambient.systemPrompt), file: relative(dir, f) };
    }
    writeFileSync(join(dir, 'transcript.jsonl'), trimTranscript(rows).map((r) => JSON.stringify(r)).join('\n') + '\n');
    const returnsFile = join(prepared.dir, 'bench-returns.jsonl');
    const returns = existsSync(returnsFile) ? readFileSync(returnsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
    const accepted = existsSync(join(prepared.dir, 'result.json'));
    let changed = [];
    try { changed = execFileSync('git', ['-C', runJson.worktree, 'status', '--porcelain'], { encoding: 'utf8' }).split('\n').filter(Boolean); } catch { changed = ['(worktree unreadable)']; }
    const bench = {
      bench: 1,
      stage,
      case: c.id,
      k,
      item,
      run: prepared.run,
      runFolder: relative(dir, prepared.dir),
      workflow: { id: spec.id, sha256: version.sha256, source: version.source },
      prompt: { sha256: sha256(sent), bytes: sent.length, sentIsBriefMd: true, context: 'appended to the system prompt (--append-system-prompt)' },
      model: init.model ?? model ?? null,
      claude: { bin: claudeBin(), version: init.claude_code_version ?? null, session: init.session_id ?? null, exit: got.code, signal: got.signal ?? null, error: result.is_error ?? null, stop: result.terminal_reason ?? result.subtype ?? null },
      at: t0,
      ms: got.ms,
      apiMs: result.duration_api_ms ?? null,
      turns: result.num_turns ?? null,
      tokens: tokensOf(result.usage),
      costUsd: result.total_cost_usd ?? null,
      ambient: { recorded: ambient.recorded, reached: ambient.recorded ? ambient.reached : null, marks: ambient.marks, attachments: ambient.attachments, systemPrompt },
      conditions: {
        tools: TOOLS,
        mcp: ['harness (scripts/bench/return-server.mjs)'],
        settingSources: 'project,local',
        env: 'CLAUDE_CODE_DISABLE_AUTO_MEMORY=1; extra CLAUDE.md folders and memory path unset',
        confine: 'not enforced: no harness hooks run; the session starts in its worktree, a temp folder outside this repo',
        github: 'none'
      },
      returns: returns.map((r) => (r.got.accepted ? { call: r.call, accepted: true } : { call: r.call, refused: r.got.refused })),
      accepted,
      firstReturnAccepted: returns.length > 0 && !!returns[0].got.accepted,
      changed
    };
    writeJson(join(dir, 'bench.json'), bench);
    log(`${c.id}.${k}: ${accepted ? 'accepted' : 'NO RESULT'} in ${Math.round(got.ms / 1000)}s, ${bench.tokens.fresh} fresh tokens, ambient ${bench.ambient.reached}`);
    return bench;
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** The prompt the bench sends for one stage input, without running a model: prepared by the engine in a temp root. */
export async function promptOnly({ stage, version, c = null, input = null, runId = null, out = null }) {
  const work = mkdtempSync(join(tmpdir(), 'bench-prompt-'));
  try {
    let repo;
    if (c) repo = caseRepo(c, work);
    else {
      repo = join(work, 'repo');
      execFileSync('git', ['init', '-q', '-b', 'main', repo]);
      execFileSync('git', ['-C', repo, '-c', 'user.email=b@e', '-c', 'user.name=b', 'commit', '-q', '--allow-empty', '-m', 'empty']);
    }
    const root = out ?? join(work, 'root');
    const spec = specOf(version, root);
    const item = runId ? runId.split(':')[0] : safe(c ? `${c.id}-prompt` : 'prompt');
    let prepared;
    if (runId || input) {
      const { prepare } = await import('../../packages/engine/src/actors.js');
      const { invokeOf, stageInput } = await import('./lib.mjs');
      const inv = invokeOf(spec, stage);
      const id = runId ?? `${item}:0.${inv.id}`;
      prepare({ host: { root, item, spec, session: SESSION, release: RELEASE, snapshot: null }, effect: { id, actor: stage, invoke: inv.id, input: input ?? stageInput(spec, stage, c?.input ?? {}), transition: null }, repo, worktrees: join(work, 'wt') });
      const { runDir } = await import('../../packages/engine/src/actors.js');
      prepared = { run: id, prompt: readFileSync(join(runDir(root, id), 'brief.md'), 'utf8') };
    } else {
      prepared = await prepareRun({ spec, actor: stage, item, root, repo, worktrees: join(work, 'wt'), caseInput: c.input });
    }
    return { run: prepared.run, prompt: prepared.prompt, workflow: spec.id };
  } finally {
    rmSync(work, { recursive: true, force: true });
  }
}

/** Run `fn` over `list`, at most n at a time, in order of start. */
export async function pool(list, n, fn) {
  const out = new Array(list.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.max(1, Math.min(n, list.length)) }, async () => {
    while (next < list.length) {
      const i = next++;
      try { out[i] = await fn(list[i], i); } catch (error) { out[i] = { error: String(error?.stack ?? error) }; }
    }
  }));
  return out;
}

async function main() {
  const { values: o } = parseArgs({
    options: {
      stage: { type: 'string', default: 'brief' }, case: { type: 'string', default: 'all' }, k: { type: 'string', default: '3' },
      workflow: { type: 'string' }, rev: { type: 'string' }, pinned: { type: 'boolean' }, out: { type: 'string' }, model: { type: 'string' },
      parallel: { type: 'string', default: '3' }, force: { type: 'boolean', default: false },
      'prompt-only': { type: 'boolean', default: false }, input: { type: 'string' }, 'run-id': { type: 'string' }
    }
  });
  const version = workflowVersion({ workflow: o.workflow, rev: o.rev, pinned: o.pinned ?? null });
  if (o['prompt-only']) {
    let input = null;
    if (o.input) { const j = readJson(o.input); input = j.input && j.run ? j.input : j; }
    const c = o.input ? null : casesOf(o.stage, o.case === 'all' ? null : o.case)[0];
    const got = await promptOnly({ stage: o.stage, version, c, input, runId: o['run-id'], out: o.out ? resolve(o.out) : null });
    process.stdout.write(got.prompt);
    return;
  }
  if (!o.out) throw new Error('--out <dir> is required');
  const out = resolve(o.out);
  mkdirSync(out, { recursive: true });
  const k = Number(o.k);
  const jobs = casesOf(o.stage, o.case).flatMap((c) => Array.from({ length: k }, (_, i) => ({ c, k: i + 1 })));
  const log = (m) => process.stderr.write(`[bench] ${m}\n`);
  log(`${jobs.length} runs of ${o.stage} on ${version.source} (${version.sha256.slice(0, 12)}), ${o.parallel} at a time`);
  const got = await pool(jobs, Number(o.parallel), (j) => benchRun({ ...j, stage: o.stage, version, out, model: o.model, force: o.force, log }));
  const failed = got.filter((g) => g?.error);
  for (const f of failed) log(`error: ${f.error}`);
  writeJson(join(out, 'set.json'), { stage: o.stage, workflow: { sha256: version.sha256, source: version.source }, model: o.model ?? null, k, cases: [...new Set(jobs.map((j) => j.c.id))], runs: got.filter((g) => g && !g.error).map((g) => `${g.case}.${g.k}`) });
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

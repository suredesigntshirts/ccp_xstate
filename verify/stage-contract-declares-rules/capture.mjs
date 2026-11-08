// What a checkout's engine does on inputs that must not change between main and the PR's head, for the Expect lines
// unmarked-as-main, prompts-unchanged and kinds-declare-stamps:
//   node verify/stage-contract-declares-rules/capture.mjs <checkout> [out.json]
// Run on main (28c2d8f) it gave evidence/main.json (node capture.mjs <main clone> evidence/main.json); the tests capture the head the same way and compare.
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, existsSync, mkdirSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { WORKFLOWS, copyWorkflows, engineOf, fixGit, rawWorkflow, strip, unmark } from './lib.mjs';

const sha = (t) => createHash('sha256').update(t).digest('hex');
const outcome = (fn) => {
  try {
    const r = fn();
    return { ok: r?.id ?? true };
  } catch (e) {
    return { refused: String(e.message) };
  }
};

// ---- prompts-unchanged: every stage's sections() and prompt, the raw meta.actors and the stage files

const madeUp = (k) => (k === 'task' ? `Made-up task: do "the thing" \\ for ${k}.` : { note: `made-up ${k} "q"`, n: k.length, list: [k, null, true], url: `https://github.com/o/r/pull/${k.length}`, at: 'a'.repeat(40) });

export async function prompts(repo) {
  const { index, stages } = await engineOf(repo);
  const out = { sections: {}, actors: {}, files: {} };
  for (const name of WORKFLOWS) {
    const spec = index.loadWorkflow(name, { dir: join(repo, 'workflows') });
    const invokes = stages.chart(spec).invokes;
    for (const actor of stages.stagesOf(spec)) {
      for (const inv of invokes.filter((i) => i.src === actor)) {
        const input = Object.fromEntries(Object.entries(inv.input ?? {}).map(([k, from]) => [k, from && typeof from === 'object' && 'value' in from ? from.value : madeUp(k)]));
        const run = { actor, schema: spec.meta.actors[actor], input, defs: spec.meta.schemas ?? {}, run: `p-${name}:1.${inv.id}` };
        let text;
        try {
          text = JSON.stringify(stages.sections(run)) + '\n----\n' + stages.render(run);
        } catch (e) { text = `threw: ${e.message}`; }
        out.sections[`${name} ${inv.at}`] = sha(text);
      }
    }
    out.actors[name] = sha(JSON.stringify(rawWorkflow(repo, name).meta.actors));
  }
  for (const d of readdirSync(join(repo, 'workflows'), { withFileTypes: true }).filter((d) => d.isDirectory())) {
    for (const f of readdirSync(join(repo, 'workflows', d.name)).sort()) out.files[`${d.name}/${f}`] = sha(readFileSync(join(repo, 'workflows', d.name, f)));
  }
  return out;
}

// ---- unmarked-as-main: load outcomes

const v = (s) => s.meta.actors.verify.properties;
// Changes of the repo workflows (without marks) whose load outcome must be the same at both shas.
const VARIANTS = {
  'quick-fix as is': {},
  'qf verify result boolean, no covers': { 'quick-fix': (s) => { delete v(s).lines.covers; v(s).result = { type: 'boolean' }; s.meta.guards.verifiedHead[0] = { path: 'context.verdict.result', in: [true] }; s.meta.guards.failed = [{ path: 'context.verdict.result', in: [false] }]; } },
  'qf verify no covers': { 'quick-fix': (s) => { delete v(s).lines.covers; } },
  'qf verify result lower words, no covers': { 'quick-fix': (s) => { delete v(s).lines.covers; v(s).result = { enum: ['pass', 'fail'] }; s.meta.guards.verifiedHead[0] = { path: 'context.verdict.result', in: ['pass'] }; s.meta.guards.failed = [{ path: 'context.verdict.result', in: ['fail'] }]; } },
  'qf verify routes on notes': { 'quick-fix': (s) => { v(s).why = { type: 'string' }; s.meta.guards.failed = ['context.verdict.why']; } },
  'qf verify result OK/BAD with covers': { 'quick-fix': (s) => { v(s).result = { enum: ['OK', 'BAD'] }; s.meta.guards.verifiedHead[0] = { path: 'context.verdict.result', in: ['OK'] }; s.meta.guards.failed = [{ path: 'context.verdict.result', in: ['BAD'] }]; } },
  'qf brief renamed': { 'quick-fix': (s) => { s.meta.actors.plan = s.meta.actors.brief; delete s.meta.actors.brief; s.states.briefing.invoke.src = 'plan'; } },
  'research verify no covers': { research: (s) => { delete v(s).lines.covers; } },
  'research passed on sources': { research: (s) => { s.meta.guards.passed.push('context.verdict.sources'); } },
  'intake challenge no covers': { intake: (s) => { delete s.meta.actors.challenge.properties.lines.covers; } },
  'intake challenge result FAIL/Pass/x': { intake: (s) => { s.meta.actors.challenge.properties.result = { enum: ['FAIL', 'Pass', 'x'] }; } }
};

export async function loads(repo) {
  const { index } = await engineOf(repo);
  const out = { variants: {}, pinned: {} };
  for (const [label, change] of Object.entries(VARIANTS)) {
    const dir = copyWorkflows(repo, change, unmark);
    for (const name of WORKFLOWS) out.variants[`${label}: ${name}`] = outcome(() => index.loadWorkflow(name, { dir }));
  }
  // Every workflow blob pinned under the repo's committed journal roots.
  const files = execFileSync('git', ['-C', repo, 'ls-files'], { encoding: 'utf8', maxBuffer: 1e9 }).split('\n').filter((f) => /\/blobs\/[0-9a-f]{64}$/.test(f));
  const seen = new Set();
  for (const f of files) {
    const hash = f.slice(-64);
    if (seen.has(hash)) continue;
    let spec;
    try { spec = JSON.parse(readFileSync(join(repo, f), 'utf8')); } catch { continue; }
    if (!spec?.states || typeof spec.id !== 'string') continue;
    seen.add(hash);
    const root = mkdtempSync(join(tmpdir(), 'scdr-pin-'));
    mkdirSync(join(root, 'blobs'));
    copyFileSync(join(repo, f), join(root, 'blobs', hash));
    out.pinned[`${spec.id}@${hash}`] = outcome(() => index.loadWorkflow(`${spec.id}@${hash}`, { root, dir: join(repo, 'workflows') }));
  }
  return out;
}

// ---- unmarked-as-main: coverGap on the same inputs

const COVERS = { properties: { result: { enum: ['PASS', 'FAIL'] }, lines: { type: 'array', covers: 'issue.expect' } } };
const lines = (...rs) => ['a', 'b'].map((line, i) => ({ line, result: rs[i] }));
const GAPS = [
  ['all pass', COVERS, { result: 'PASS', lines: lines('PASS', 'PASS') }],
  ['result fail, lines pass', COVERS, { result: 'FAIL', lines: lines('PASS', 'PASS') }],
  ['result pass, a line fails', COVERS, { result: 'PASS', lines: lines('PASS', 'FAIL') }],
  ['lower pass, lines pass', COVERS, { result: 'pass', lines: lines('PASS', 'PASS') }],
  ['lower pass, lower line fail', COVERS, { result: 'pass', lines: lines('pass', 'fail') }],
  ['Fail, lines pass', COVERS, { result: 'Fail', lines: lines('PASS', 'PASS') }],
  ['another word field disagrees', COVERS, { result: 'PASS', note: 'fail', lines: lines('PASS', 'PASS') }],
  ['another word field agrees', COVERS, { result: 'FAIL', note: 'Fail', lines: lines('FAIL', 'PASS') }],
  ['non-word result', COVERS, { result: 'OK', lines: lines('OK', 'OK') }],
  ['missing line', COVERS, { result: 'PASS', lines: [{ line: 'a', result: 'PASS' }] }],
  ['extra line', COVERS, { result: 'PASS', lines: [...lines('PASS', 'PASS'), { line: 'c', result: 'PASS' }] }],
  ['order', COVERS, { result: 'PASS', lines: [{ line: 'b', result: 'PASS' }, { line: 'a', result: 'PASS' }] }],
  ['no covers', { properties: { result: { enum: ['PASS'] } } }, { result: 'FAIL' }]
];

export async function gaps(repo) {
  const { stages } = await engineOf(repo);
  return Object.fromEntries(GAPS.map(([label, schema, result]) => [label, strip({ gap: stages.coverGap(schema, { issue: { expect: ['a', 'b'] } }, result), uncovered: stages.uncovered(schema, { issue: { expect: ['a', 'b'] } }, result) })]));
}

// ---- unmarked-as-main and kinds-declare-stamps: accept through the real hooks in a fake world

const ISSUE = { url: 'https://github.com/o/r/issues/7', title: 'Add multiply', body: 'Add multiply to math.js.', expect: ['math.js exports multiply', 'README documents multiply'] };
const RISSUE = { url: 'https://github.com/o/r/issues/8', title: 'Research', body: 'Which?', expect: ['names one', 'cites a page'] };

/** Accept through world.agent, recording accept's answer, the rows it added and the blobs it stored. */
function recorder(w, item) {
  const paths = { root: w.root, repo: w.repo };
  const log = [];
  return {
    log,
    async call(label, actor, act, agentId) {
      const before = w.rows(item).length;
      const blobsBefore = new Set(existsSync(join(w.root, 'blobs')) ? readdirSync(join(w.root, 'blobs')) : []);
      let ret;
      try { ret = await w.agent(item, actor, act, agentId); } catch (e) { ret = { threw: e.message }; }
      const rows = w.rows(item).slice(before).filter((r) => ['refusal', 'result.stored', 'brief.stored', 'run.failed'].includes(r.kind));
      const blobs = {};
      for (const b of readdirSync(join(w.root, 'blobs'))) if (!blobsBefore.has(b)) {
        const t = readFileSync(join(w.root, 'blobs', b), 'utf8');
        if (!t.includes('"states"')) blobs[b] = t;
      }
      log.push(strip({ label, ret, rows, blobs }, paths));
      return ret;
    }
  };
}

const verifyWith = (w, result, lineResults, extra = {}) => async ({ input, worktree }) => {
  w.checkout(worktree, input.target.at);
  return { result, pr: { url: input.target.url, at: input.target.at }, issue: structuredClone(input.issue), lines: input.issue.expect.map((line, i) => ({ line, result: lineResults[i] ?? lineResults[0], evidence: `seen: ${line}` })), ...extra };
};

async function quickFixScenario(W, dir, verdicts) {
  const w = await W.makeWorld({ dir });
  try {
    const r = recorder(w, 'q1');
    await w.start('q1', 'quick-fix', { issue: ISSUE });
    await r.call('brief', 'brief', async () => ({ builder: 'build multiply', verifier: 'check multiply' }), 'ag-b');
    await w.drive('q1');
    // Refs the host refuses: a PR not on GitHub, a PR whose head is elsewhere; then one with a gate file and green CI.
    await r.call('build: no such PR', 'build', async ({ worktree }) => ({ pr: { url: 'https://github.com/o/r/pull/99', at: w.commit(worktree, 'b0') } }), 'ag-1');
    await r.call('build: head elsewhere', 'build', async ({ worktree }) => { const h = w.commit(worktree, 'b1'); w.gh.open(1, 'f'.repeat(40)); return { pr: { url: W.prUrl(1), at: h } }; }, 'ag-1');
    await r.call('build: stamped', 'build', W.builds(w, 1, { files: ['.github/workflows/ci.yml', 'math.js'] }), 'ag-1');
    await w.drive('q1');
    if (w.host('q1').snapshot.value !== 'verifying') await w.drive('q1', W.suiteWake(w.host('q1').snapshot.context.pr.at));
    for (const [label, result, ls] of verdicts) await r.call(`verify: ${label}`, 'verify', verifyWith(w, result, ls), 'ag-v');
    return r.log;
  } finally { await w.close(); }
}

async function researchScenario(W, dir) {
  const w = await W.makeWorld({ dir, pages: { 'https://example.com/a': 'The page says multiply is fine.' } });
  try {
    const r = recorder(w, 'r1');
    await w.start('r1', 'research', { issue: RISSUE });
    await r.call('brief', 'brief', async () => ({ questions: ['q one', 'q two', 'q three'], researcher: 'find out', writer: 'write it', verifier: 'check it' }), 'ag-rb');
    await w.drive('r1');
    await r.call('q1: page holds text', 'q1', async () => ({ text: 'one', sources: [{ url: 'https://example.com/a', at: 'multiply is fine' }] }), 'ag-q1');
    await r.call('q2: page lacks text', 'q2', async () => ({ text: 'two', sources: [{ url: 'https://example.com/a', at: 'not on the page' }] }), 'ag-q2');
    await r.call('q2: source is a PR url', 'q2', async () => ({ text: 'two', sources: [{ url: 'https://github.com/o/r/pull/9', at: 'a quoted line' }] }), 'ag-q2');
    return r.log;
  } finally { await w.close(); }
}

const VERDICTS = [
  ['FAIL over passing lines', 'FAIL', ['PASS', 'PASS']],
  ['PASS over a failing line', 'PASS', ['PASS', 'FAIL']],
  ['FAIL over a failing line', 'FAIL', ['FAIL', 'PASS']]
];
const LOWER = [
  ['pass over a fail line', 'pass', ['pass', 'fail']],
  ['fail over pass lines', 'fail', ['pass', 'pass']],
  ['pass over pass lines', 'pass', ['pass', 'pass']]
];
const lower = (s) => {
  v(s).result = { enum: ['pass', 'fail'] };
  s.meta.schemas.line.properties.result = { enum: ['pass', 'fail'] };
  s.meta.guards.verifiedHead[0] = { path: 'context.verdict.result', in: ['pass'] };
  s.meta.guards.failed = [{ path: 'context.verdict.result', in: ['fail'] }];
};

export async function accepts(repo) {
  fixGit();
  const { world: W } = await engineOf(repo);
  return {
    'quick-fix unmarked': await quickFixScenario(W, copyWorkflows(repo, {}, unmark), VERDICTS),
    'quick-fix unmarked, lower-case words': await quickFixScenario(W, copyWorkflows(repo, { 'quick-fix': lower }, unmark), LOWER),
    'research unmarked': await researchScenario(W, copyWorkflows(repo, {}, unmark)),
    // kinds-declare-stamps: the repo's own workflows (marked at the head), the same fake GitHub.
    'quick-fix as in the repo': await quickFixScenario(W, join(repo, 'workflows'), [['all pass', 'PASS', ['PASS', 'PASS']]])
  };
}

export async function capture(repo) {
  repo = resolve(repo);
  const { stages } = await engineOf(repo);
  return { stamped: { STAMPED: [...stages.STAMPED], HIDDEN: [...stages.HIDDEN] }, prompts: await prompts(repo), loads: await loads(repo), gaps: await gaps(repo), accepts: await accepts(repo) };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const out = JSON.stringify(await capture(process.argv[2]), null, 1);
  if (process.argv[3]) writeFileSync(process.argv[3], `${out}\n`); else console.log(out);
}

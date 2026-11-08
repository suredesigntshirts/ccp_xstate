// Pure checks behind the PR gates in .github/workflows/verdict.yml. pr-gate.mjs feeds them from git and the PR
// event; the tests feed them directly. Each check returns a list of reasons, empty when it passes. See docs/gates.md.

const HEAD_RE = /^```json\n([\s\S]*?)\n```/;
const BRIEF_RE = /^## Verifier brief$/m;

// The JSON head of an item file, or null when it has none or it isn't JSON.
export function itemHead(text) {
  const m = text?.match(HEAD_RE);
  if (!m) return null;
  try { return JSON.parse(m[1]); } catch { return null; }
}

// The frozen part of an item: its head without status, done_on and reader_effort (which record where the build is and
// what it cost, not what it must show), and its Verifier brief.
function contractParts(text) {
  const { status, done_on, reader_effort, ...rest } = itemHead(text) ?? {};
  return { head: rest, brief: section(text, BRIEF_RE) ?? '' };
}

export function contract(text) {
  return text == null ? null : JSON.stringify(contractParts(text));
}

// The text of an item's `## <title>` section up to the next `## ` heading, trimmed, or null when it has none.
function section(text, re) {
  const parts = text.split(re);
  return parts.length > 1 ? parts[1].split(/^## /m)[0].trim() : null;
}

// What moved in an item's contract between two texts of its file: the head fields whose values differ, and
// `Verifier brief` when the brief does. Empty when the contracts match.
export function contractMoves(before, after) {
  const a = contractParts(before), b = contractParts(after);
  const keys = [...new Set([...Object.keys(a.head), ...Object.keys(b.head)])];
  const moved = keys.filter((k) => JSON.stringify(a.head[k]) !== JSON.stringify(b.head[k]));
  return a.brief === b.brief ? moved : [...moved, 'Verifier brief'];
}

// The verdict cutoff: a verdict holds only for the contract it verified, so the item's contract at verified_sha must
// match the head's. before is the item file at verified_sha (null when absent), after at the head.
export function checkCutoff({ item, verified, before, after }) {
  const at = `the verified sha ${verified.slice(0, 7)}`;
  if (before == null) return [`plan/items/${item}.md does not exist at ${at}, so the verdict verified no contract of ${item}`];
  const moved = contractMoves(before, after ?? '');
  return moved.length ? [`the contract of ${item} moved after ${at} (${moved.join(', ')}); a verdict holds only for the contract it verified, so verify again at the head`] : [];
}

const DONE_ON_RE = /^## Done on change$/m;

// A set done_on moves only by a PR labelled replan that changes nothing outside plan/ and whose item says why in a
// `## Done on change` section that differs from the base's. Setting done_on where it was absent is free. items is
// [{ id, before, after }], the item files at base and head for every item whose done_on is set at the base.
export function checkDoneOn({ changed, items, labels }) {
  const outside = changed.filter((p) => !p.startsWith('plan/'));
  const replan = labels.includes('replan') && !outside.length;
  const reasons = [];
  for (const { id, before, after } of items) {
    const was = itemHead(before)?.done_on;
    const now = after == null ? undefined : itemHead(after)?.done_on;
    if (was === undefined || was === now) continue;
    const why = after != null && section(after, DONE_ON_RE);
    const said = why && why !== section(before, DONE_ON_RE);
    if (replan && said) continue;
    reasons.push(`changes done_on of ${id} from ${was} to ${now ?? '(none)'}; a set done_on moves only by a PR labelled replan ` +
      `that touches nothing but plan/ and says why under ## Done on change` +
      (!labels.includes('replan') ? '' : outside.length ? `, but this one touches ${outside.join(', ')}` : ', which this one does not add or rewrite'));
  }
  return reasons;
}

// Which item a PR names: the `Item: <id>` line in its body, and nothing else. The branch name is for people.
export function namedItem({ body = '', ids }) {
  const item = body.match(/^Item:\s*([a-z0-9-]+)\s*$/m)?.[1] ?? null;
  if (item && !ids.has(item)) return { item: null, reasons: [`the body names item ${item}, which plan/items/ doesn't have`] };
  return { item, reasons: [] };
}

// Contract freeze: a PR may not change the head or Verifier brief of a frozen item (the one it names, one whose status
// at base is doing or done, or one with a verdict file). Before verification starts, a PR labelled replan that touches
// only plan/ may; once verify/<id>/verdict.json exists at base or head (`verdict` names it), nothing may.
export function checkFreeze({ changed, frozen, labels }) {
  const touched = frozen.filter((f) => f.before !== null && contract(f.before) !== contract(f.after));
  const outside = changed.filter((p) => !p.startsWith('plan/'));
  const replan = labels.includes('replan') && !outside.length;
  return touched.filter((f) => f.verdict || !replan).map((f) => `changes the contract of ${f.id} (its head or Verifier brief)` +
    (f.verdict ? `; ${f.verdict} exists, so verification has started and nothing may change it`
      : labels.includes('replan') ? `; a replan PR touches only plan/, but this one touches ${outside.join(', ')}`
        : '; only a PR labelled replan that touches nothing but plan/ may'));
}

// Verdict gate: verdict.json marks every Expect id of the item head MET, with the command and an output excerpt; names
// the test that proves every verifier and builder line (a file under verify/<item>/, and optionally a test name), which
// the gate then runs; names a mutation and the test it turned red for every builder line; and keeps what the verifier
// judged rather than ran in observations, a list of strings that never gates.
export function checkVerdict({ item, head, verdict }) {
  if (!verdict) return [`no verify/${item}/verdict.json at the head sha`];
  if (verdict.item !== item) return [`verdict.json is for item ${verdict.item}, not ${item}`];
  const reasons = [];
  const results = new Map((Array.isArray(verdict.results) ? verdict.results : []).map((r) => [r?.id, r]));
  const filled = (v) => typeof v === 'string' && v.trim() !== '';
  for (const e of head.expect ?? []) {
    const r = results.get(e.id);
    if (!r) { reasons.push(`verdict has no result for Expect ${e.id}`); continue; }
    if (r.status !== 'MET') reasons.push(`Expect ${e.id} is ${r.status ?? 'unmarked'}, not MET`);
    if (!filled(r.command)) reasons.push(`Expect ${e.id} names no command`);
    if (!filled(r.excerpt)) reasons.push(`Expect ${e.id} has no output excerpt`);
    if (TESTED.includes(e.proof)) {
      const why = testPathFault(item, r.test);
      if (why) reasons.push(`Expect ${e.id} is ${e.proof}-proven, so it names the test that proves it: ${why}`);
      if (r.test_name !== undefined && !filled(r.test_name)) reasons.push(`Expect ${e.id} has an empty test_name`);
    }
    if (e.proof === 'builder' && !(filled(r.mutation) && filled(r.red_test)))
      reasons.push(`Expect ${e.id} is builder-proven, so it needs a mutation and the test it turned red`);
  }
  for (const id of results.keys()) if (!(head.expect ?? []).some((e) => e.id === id))
    reasons.push(`verdict marks ${id}, which the item head doesn't have`);
  if (verdict.observations !== undefined && !(Array.isArray(verdict.observations) && verdict.observations.every(filled)))
    reasons.push('observations is a list of non-empty strings');
  return reasons;
}

// The proofs whose verdict result names a test the gate runs. A world line is shown by the platform, not a test.
const TESTED = ['verifier', 'builder'];

function testPathFault(item, test) {
  if (typeof test !== 'string' || !test.trim()) return 'test is missing';
  const parts = test.split('/');
  if (parts[0] !== 'verify' || parts[1] !== item || parts.length < 3 || parts.some((p) => p === '..' || p === '.' || p === ''))
    return `test ${test} is not a path under verify/${item}/`;
  return null;
}

// The tests a verdict names, one entry per file and name, each with the Expect ids it proves; pr-gate.mjs runs them.
export function verdictTests({ head, verdict }) {
  const proofs = new Map((head.expect ?? []).map((e) => [e.id, e.proof]));
  const runs = new Map();
  for (const r of Array.isArray(verdict?.results) ? verdict.results : []) {
    if (!TESTED.includes(proofs.get(r?.id)) || typeof r.test !== 'string') continue;
    const key = JSON.stringify([r.test, r.test_name ?? null]);
    if (!runs.has(key)) runs.set(key, { file: r.test, name: r.test_name ?? null, ids: [] });
    runs.get(key).ids.push(r.id);
  }
  return [...runs.values()];
}

// Why a named test's run fails the gate, or null: it exited non-zero, or it ran no test.
export function testRunFault({ file, name, ids }, { status, output }) {
  const label = `Expect ${ids.join(', ')}: test ${file}${name ? ` (${name})` : ''}`;
  const tail = output.trim().split('\n').filter((l) => /^# (?:tests|pass|fail)|^not ok|Error/.test(l)).slice(0, 8).join(' | ');
  if (status !== 0) return `${label} fails at the head (exit ${status})${tail ? `: ${tail}` : ''}`;
  const passed = Number(output.match(/^# pass (\d+)/m)?.[1] ?? 0);
  if (!passed) return `${label} ran no test that passed${tail ? `: ${tail}` : ''}`;
  return null;
}

// Evidence: what a plan verifier commits under verify/ says what was shown, one small file per Expect line, so a PR
// may not add, change or rename a file there to one larger than EVIDENCE_LIMIT, one named *.pass, one whose text is a
// test listing, or an entry that is not a regular file (a symlink's size is its target's name, not what it points at).
// files is [{ path, size, mode, text }] for the paths the PR adds, changes or renames; deleted files are never passed.
export const EVIDENCE_LIMIT = 64 * 1024;
export const LISTING_LINES = 10;
const REGULAR = new Set(['100644', '100755']);
const KIND = { '120000': 'a symlink', '160000': 'a submodule', '040000': 'a tree' };

// A node:test listing, TAP or spec reporter: a pass and a fail summary line and at least LISTING_LINES result lines,
// so an excerpt quoting a few result lines and the summary is not one.
export function isListing(text = '') {
  const lines = text.split('\n');
  const has = (word) => lines.some((l) => new RegExp(`^\\s*(?:#|\u2139) ${word} \\d+\\s*$`).test(l));
  const results = lines.filter((l) => /^\s*(?:(?:not )?ok \d+\b|[\u2714\u2716] \S)/.test(l)).length;
  return has('pass') && has('fail') && results >= LISTING_LINES;
}

export function checkEvidence(files) {
  const reasons = [];
  const instead = 'commit the command, the excerpt and the inputs instead';
  for (const { path, size, mode = '100644', text } of files) {
    if (!path.startsWith('verify/')) continue;
    if (!REGULAR.has(mode)) {
      reasons.push(`${path} is ${KIND[mode] ?? `not a regular file (mode ${mode})`}; a file under verify/ must be a regular file, so ${instead}`);
      continue;
    }
    if (path.endsWith('.pass')) reasons.push(`${path} is a test listing (.pass); ${instead}`);
    else if (isListing(text)) reasons.push(`${path} is a test listing (node:test results and a pass and fail summary); ${instead}`);
    if (size > EVIDENCE_LIMIT)
      reasons.push(`${path} is ${size} bytes, over the ${EVIDENCE_LIMIT}-byte limit for a file under verify/; ${instead}`);
  }
  return reasons;
}

// The Claude-Session trailer of a commit message, or null.
export function sessionOf(message) {
  return message.match(/^Claude-Session:\s*(\S+)\s*$/m)?.[1] ?? null;
}

// Separate session: the commit that last wrote verdict.json has a Claude-Session trailer that no builder commit
// (one touching anything outside verify/) carries. Commits after the verified sha may touch only verify/.
export function checkSessions({ item, verdictCommit, builderCommits, afterVerified }) {
  const reasons = [];
  if (!verdictCommit) return [`no commit in this PR writes verify/${item}/verdict.json`];
  const own = sessionOf(verdictCommit.message);
  if (!own) reasons.push(`the verdict commit ${verdictCommit.sha.slice(0, 7)} has no Claude-Session trailer`);
  for (const c of builderCommits) if (own && sessionOf(c.message) === own)
    reasons.push(`the verdict commit carries the same Claude-Session as builder commit ${c.sha.slice(0, 7)}`);
  for (const c of afterVerified)
    reasons.push(`commit ${c.sha.slice(0, 7)} changes ${c.files.find((f) => !f.startsWith('verify/'))} after the verified sha`);
  return reasons;
}

// Stub ban: no TODO, FIXME, "not implemented" or skipped test under packages/ or plugins/.
const STUBS = [
  [/\bTODO\b/, 'TODO'],
  [/\bFIXME\b/, 'FIXME'],
  [/not implemented/i, '"not implemented"'],
  [/\b(?:test|it|describe|suite)\.(?:skip|todo)\b/, 'a skipped test'],
  [/\{[^}]*\b(?:skip|todo)\s*:\s*(?:true|['"`])/, 'a skipped test'],
  [/\bt\.(?:skip|todo)\s*\(/, 'a skipped test'],
];

// History ban: the harness source and its two READMEs state what holds now. A plan item id, a design letter's
// section, a tournament lane, round or graft names where a line came from, and that belongs in the commit, the PR and
// the plan (CLAUDE.md). Tests and vendored code are not held to it: a test may name a lane it runs.
export const HISTORY = /plan item|\((?:fix|engine|obs|wf|inspector|stage|prompt|probe|journal|refine)-[a-z-]+[),]|[Dd]esign [A-E],|lane [A-E]|graft|round[- ][12]|before (?:fix|stage|prompt)-/;
const HISTORY_RULE = 'a history reference (comments say what holds now; item ids go in commits, PRs and the plan)';
const HISTORY_DIRS = /^(?:packages\/engine\/(?:src|bin)|packages\/journal\/(?:src|bin)|plugins\/harness\/scripts|scripts\/inspector|scripts\/bench)\//;
const HISTORY_FILES = new Set(['packages/engine/README.md', 'plugins/harness/README.md']);
const isTest = (path) => /(?:^|\/)test\/|\.test\.[cm]?js$/.test(path);
export const historyChecked = (path) =>
  HISTORY_FILES.has(path) || (HISTORY_DIRS.test(path) && !isTest(path) && !/(?:^|\/)vendor\//.test(path));

export function findStubs(files) {
  const reasons = [];
  for (const { path, text } of files) {
    const stubs = /^(packages|plugins)\//.test(path);
    const history = historyChecked(path);
    if (!stubs && !history) continue;
    text.split('\n').forEach((line, i) => {
      const what = (stubs && STUBS.find(([re]) => re.test(line))?.[1]) || (history && HISTORY.test(line) && HISTORY_RULE);
      if (what) reasons.push(`${path}:${i + 1} has ${what}`);
    });
  }
  return reasons;
}

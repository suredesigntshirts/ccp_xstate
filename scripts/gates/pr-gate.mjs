#!/usr/bin/env node
// Runs one PR gate against a git checkout: node scripts/gates/pr-gate.mjs stubs|freeze|evidence|verdict
// Reads BASE_SHA, HEAD_SHA, PR_BRANCH, PR_BODY and PR_LABELS (a JSON array) from the environment, which
// .github/workflows/verdict.yml fills from the pull_request event. Prints each reason and exits 1 if there is any.
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { checkEvidence, checkFreeze, checkSessions, checkVerdict, findStubs, itemHead, namedItem, testRunFault, verdictTests } from './lib.mjs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'] })
  .trimEnd();
const show = (rev, path) => { try { return git('show', `${rev}:${path}`); } catch { return null; } };
const lines = (s) => s.split('\n').filter(Boolean);

const env = process.env;
const head = env.HEAD_SHA || git('rev-parse', 'HEAD');
const base = git('merge-base', env.BASE_SHA, head);
const labels = JSON.parse(env.PR_LABELS || '[]');
const changed = lines(git('diff', '--name-only', base, head));
const commits = lines(git('rev-list', '--no-merges', `${base}..${head}`)).map((sha) => ({
  sha,
  message: git('log', '-1', '--format=%B', sha),
  files: lines(git('diff-tree', '--no-commit-id', '--name-only', '-r', '--root', sha)),
}));
const itemIds = (rev) => new Set(lines(git('ls-tree', '--name-only', rev, 'plan/items/'))
  .map((p) => p.replace(/^plan\/items\//, '')).filter((f) => f.endsWith('.md') && f !== 'README.md')
  .map((f) => f.slice(0, -3)));
const named = namedItem({ branch: env.PR_BRANCH, body: env.PR_BODY, ids: itemIds(head) });

// Runs each test file a verdict names under node:test with the TAP reporter, from the checkout, which must be at the
// head sha. The file runs as the entry point, not under --test, so the summary counts its own tests and a name that
// matches none passes nothing.
function runTests(runs) {
  if (!runs.length) return [];
  if (git('rev-parse', 'HEAD') !== git('rev-parse', head))
    return [`the named tests run from the checkout, which is not at the head sha ${head.slice(0, 7)}`];
  return runs.map((run) => {
    if (!existsSync(run.file)) return `Expect ${run.ids.join(', ')}: test ${run.file} does not exist at the head`;
    const args = ['--test-reporter=tap', ...(run.name ? [`--test-name-pattern=${run.name}`] : []), run.file];
    const { NODE_TEST_CONTEXT, ...env } = process.env; // a gate run inside node --test still reports in TAP
    const r = spawnSync(process.execPath, args, { encoding: 'utf8', env, maxBuffer: 64 << 20, timeout: 15 * 60 * 1000 });
    return testRunFault(run, { status: r.status ?? 1, output: `${r.stdout ?? ''}${r.stderr ?? ''}${r.error ? `\n${r.error.message}` : ''}` });
  }).filter(Boolean);
}

const gates = {
  stubs() {
    const files = lines(git('ls-tree', '-r', '--name-only', head, 'packages/', 'plugins/', 'scripts/'))
      .map((path) => ({ path, text: show(head, path) ?? '' }));
    return findStubs(files);
  },

  freeze() {
    const verdictFile = (id) => `verify/${id}/verdict.json`;
    const verified = (id) => show(base, verdictFile(id)) !== null || show(head, verdictFile(id)) !== null;
    const frozenIds = new Set([...itemIds(base)].filter((id) => id === named.item || verified(id) ||
      ['doing', 'done'].includes(itemHead(show(base, `plan/items/${id}.md`))?.status)));
    const frozen = [...frozenIds].map((id) => ({
      id, before: show(base, `plan/items/${id}.md`), after: show(head, `plan/items/${id}.md`) ?? '',
      verdict: verified(id) ? verdictFile(id) : null,
    }));
    return [...named.reasons, ...checkFreeze({ changed, frozen, labels })];
  },

  evidence() {
    const kept = git('diff', '-z', '--name-only', '--no-renames', '--diff-filter=d', base, head, '--', 'verify/')
      .split('\0').filter(Boolean);
    return checkEvidence(kept.map((path) => ({ path, size: Number(git('cat-file', '-s', `${head}:${path}`)) })));
  },

  verdict() {
    if (named.reasons.length) return named.reasons;
    const { item } = named;
    if (!item) return changed.every((p) => p.startsWith('plan/')) ? []
      : ['this PR changes files outside plan/ but names no item (add an "Item: <id>" line to its body)'];
    const itemHeadNow = itemHead(show(head, `plan/items/${item}.md`));
    let verdict = null;
    const raw = show(head, `verify/${item}/verdict.json`);
    if (raw !== null) {
      try { verdict = JSON.parse(raw); } catch (e) { return [`verify/${item}/verdict.json is not JSON: ${e.message}`]; }
    }
    const reasons = checkVerdict({ item, head: itemHeadNow, verdict });
    if (!verdict) return reasons;
    reasons.push(...runTests(verdictTests({ head: itemHeadNow, verdict })));

    const outside = (c) => c.files.some((f) => !f.startsWith('verify/'));
    let afterVerified = [];
    const verified = verdict.verified_sha;
    let known = false;
    try { known = typeof verified === 'string' && git('rev-parse', '--verify', `${verified}^{commit}`) !== ''; } catch {}
    if (!known) reasons.push(`verdict.json's verified_sha ${verified ?? '(missing)'} is not a commit here`);
    else {
      try { git('merge-base', '--is-ancestor', verified, head); } catch { reasons.push(`verified_sha ${verified} is not in this PR's history`); }
      const after = new Set(lines(git('rev-list', '--no-merges', `${verified}..${head}`)));
      afterVerified = commits.filter((c) => after.has(c.sha) && outside(c));
    }
    reasons.push(...checkSessions({
      item,
      verdictCommit: commits.find((c) => c.files.includes(`verify/${item}/verdict.json`)),
      builderCommits: commits.filter(outside),
      afterVerified,
    }));
    return reasons;
  },
};

const which = process.argv[2];
if (!gates[which]) { console.error(`usage: pr-gate.mjs ${Object.keys(gates).join('|')}`); process.exit(2); }
const reasons = gates[which]();
const about = named.item ? ` (item ${named.item})` : '';
if (reasons.length) {
  console.error(`${which} gate failed${about}:\n  ${reasons.join('\n  ')}`);
  process.exit(1);
}
console.log(`${which} gate passed${about}`);

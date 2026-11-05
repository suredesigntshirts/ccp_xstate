// Trial gh stand-in (ported from trial 2's). Supports exactly:
//   gh pr create [--title|-t T] [--body|-b B | --body-file|-F F] [--base|-B main] [--head|-H BRANCH] [--fill] [--repo|-R o/r] [--draft]
//   gh pr view [<number>|<url>|<branch>] [--json f1,f2 [--jq|-q EXPR(ignored: prints JSON)]]   (fields: number,url,state,title,body,headRefName,headRefOid,baseRefName,files)
//   gh pr list [--json ...]   (open PRs, one line each, or JSON)
//   gh auth status
// against the fake GitHub state (gh-state.json) for the one repository o/r. The repo comes from --repo or the
// worktree's origin url. Anything else is refused with exit 1; nothing here reaches the network.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

// Copied to <trial dir>/shim/gh.mjs by drive.mjs init, so the trial dir is this file's parent's parent.
const T = process.env.TRIAL_DIR ?? new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const STATE = `${T}/gh-state.json`;
const ORIGIN = `${T}/world/origin.git`;
const die = (msg, code = 1) => { process.stderr.write(`${msg}\n`); process.exit(code); };
const args = process.argv.slice(2);
const log = (o) => { try { writeFileSync(`${T}/shim-calls.jsonl`, `${JSON.stringify({ at: new Date().toISOString(), cwd: process.cwd(), args, ...o })}\n`, { flag: 'a' }); } catch {} };
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const opt = (names) => { for (let i = 0; i < args.length; i++) { for (const n of names) { if (args[i] === n) return args[i + 1]; if (args[i].startsWith(`${n}=`)) return args[i].slice(n.length + 1); } } return undefined; };
const has = (n) => args.includes(n);
const load = () => JSON.parse(readFileSync(STATE, 'utf8'));
const urlOf = (n) => `https://github.com/o/r/pull/${n}`;

function repoHere() {
  const r = opt(['--repo', '-R']);
  if (r) return r.replace(/^https:\/\/github\.com\//, '').replace(/\.git$/, '');
  let url;
  try { url = git('config', '--get', 'remote.origin.url'); } catch { die('failed to determine base repo: not a git repository or no origin remote'); }
  const m = url.match(/github\.com[/:]([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
  if (!m) die(`none of the git remotes configured for this repository point to a known GitHub host (origin is ${url})`);
  return m[1];
}
const onlyOR = (repo) => { if (repo !== 'o/r') { log({ refused: repo }); die(`HTTP 403: GitHub access to ${repo} is not enabled in this environment`); } };

const [cmd, sub] = args;
if (cmd === 'auth' && sub === 'status') { log({}); console.log('github.com\n  ✓ Logged in to github.com account trial-bot (keyring)\n  - Active account: true\n  - Git operations protocol: https\n  - Token scopes: \'repo\''); process.exit(0); }
if (cmd !== 'pr' || !['create', 'view', 'list'].includes(sub)) { log({ unsupported: true }); die(`gh ${args.slice(0, 2).join(' ')}: not supported in this environment (supported: gh pr create, gh pr view, gh pr list, gh auth status)`); }
const repo = repoHere();
onlyOR(repo);
const s = load();
const fields = (p, n) => ({ number: Number(n), url: urlOf(n), state: p.merged ? 'MERGED' : 'OPEN', title: p.title ?? '', body: p.body ?? '', headRefName: p.branch, headRefOid: p.head, baseRefName: p.base, files: (p.files ?? []).map((path) => ({ path })) });
const pick = (obj) => { const want = opt(['--json']); if (!want) return null; return Object.fromEntries(want.split(',').map((k) => [k, obj[k]])); };

if (sub === 'create') {
  let head = opt(['--head', '-H']);
  if (!head) { try { head = git('rev-parse', '--abbrev-ref', 'HEAD'); } catch { die('could not determine the current branch'); } }
  if (head === 'HEAD') die('could not determine the current branch: HEAD is detached; use --head');
  const base = opt(['--base', '-B']) ?? 'main';
  let sha = '';
  try { sha = execFileSync('git', ['--git-dir', ORIGIN, 'rev-parse', '--verify', `refs/heads/${head}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch {}
  if (!sha) { log({ error: 'not pushed', head }); die(`aborted: you must first push the current branch to a remote, or use the --head flag`); }
  const open = Object.entries(s.prs).find(([, p]) => p.branch === head && !p.merged);
  if (open) { log({ error: 'exists', pr: open[0] }); die(`a pull request for branch "${head}" into branch "${base}" already exists:\n${urlOf(open[0])}`); }
  let title = opt(['--title', '-t']);
  let body = opt(['--body', '-b']);
  const bf = opt(['--body-file', '-F']);
  if (bf) body = readFileSync(bf === '-' ? 0 : bf, 'utf8');
  if (has('--fill') || title == null) { title ??= execFileSync('git', ['--git-dir', ORIGIN, 'log', '-1', '--format=%s', sha], { encoding: 'utf8' }).trim(); body ??= ''; }
  if (body == null) die('must provide `--title` and `--body` (or `--fill`) when not running interactively');
  const files = execFileSync('git', ['--git-dir', ORIGIN, 'diff', '--name-only', `${base}...${sha}`], { encoding: 'utf8' }).trim().split('\n').filter(Boolean);
  const n = String(Object.keys(s.prs).length + 1);
  s.prs[n] = { head: sha, base, branch: head, files, merged: false, mergeSha: null, title, body, draft: has('--draft') };
  execFileSync('git', ['--git-dir', ORIGIN, 'update-ref', `refs/pull/${n}/head`, sha]);
  writeFileSync(STATE, JSON.stringify(s, null, 2));
  log({ created: n, head, sha });
  process.stderr.write(`\nCreating pull request for ${head} into ${base} in o/r\n\n`);
  console.log(urlOf(n));
  process.exit(0);
}
if (sub === 'list') {
  const open = Object.entries(s.prs).filter(([, p]) => !p.merged);
  log({});
  if (opt(['--json'])) { console.log(JSON.stringify(open.map(([n, p]) => pick(fields(p, n))), null, 2)); process.exit(0); }
  if (!open.length) { console.log('no open pull requests in o/r'); process.exit(0); }
  for (const [n, p] of open) console.log(`#${n}\t${p.title ?? ''}\t${p.branch}\tOPEN`);
  process.exit(0);
}
// view
const sel = args[2] && !args[2].startsWith('-') ? args[2] : null;
let entry;
if (sel) {
  const num = sel.match(/(?:pull\/)?(\d+)\/?$/)?.[1];
  entry = num ? [num, s.prs[num]] : Object.entries(s.prs).find(([, p]) => p.branch === sel);
} else {
  let br = ''; try { br = git('rev-parse', '--abbrev-ref', 'HEAD'); } catch {}
  entry = Object.entries(s.prs).find(([, p]) => p.branch === br);
}
if (!entry || !entry[1]) { log({ error: 'no pr' }); die(sel ? `GraphQL: Could not resolve to a PullRequest with the number of ${sel}. (repository.pullRequest)` : 'no pull requests found for the current branch'); }
const f = fields(entry[1], entry[0]);
log({ viewed: entry[0] });
if (opt(['--json'])) { console.log(JSON.stringify(pick(f), null, 2)); process.exit(0); }
console.log(`${f.title} o/r#${f.number}\n${f.state} • ${f.headRefName} into ${f.baseRefName} • head ${f.headRefOid}\n\n${f.body}\n\nView this pull request on GitHub: ${f.url}`);

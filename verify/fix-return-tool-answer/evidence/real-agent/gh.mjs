// A stub GitHub REST server for the real-agent check: PR o/r#1 whose head is the given worktree's HEAD at each request
// (so the agent's own commit is what GitHub shows), branch fix-1 in o/r, no files, CI green. Logs each request.
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
const [port, worktree] = process.argv.slice(2);
createServer((req, res) => {
  const reply = (s, j) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
  const p = req.url.split('?')[0];
  console.log(new Date().toISOString(), req.method, p);
  if (/\/check-suites$/.test(p)) return reply(200, { total_count: 1, check_suites: [{ status: 'completed', conclusion: 'success' }] });
  const m = p.match(/^\/repos\/o\/r\/pulls\/1(\/files)?$/);
  if (!m) return reply(404, { message: 'Not Found' });
  if (m[1]) return reply(200, []);
  const head = execFileSync('git', ['-C', worktree, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  return reply(200, { number: 1, merged: false, state: 'open', head: { sha: head, ref: 'fix-1', repo: { full_name: 'o/r' } }, base: { ref: 'main' } });
}).listen(Number(port), '127.0.0.1');

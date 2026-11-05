// A stub GitHub REST server for the real-agent check: PR o/r#1 (and #2) at the head given, no files, CI green.
import { createServer } from 'node:http';
const [port, head] = process.argv.slice(2);
createServer((req, res) => {
  const reply = (s, j) => { res.writeHead(s, { 'content-type': 'application/json' }); res.end(JSON.stringify(j)); };
  const p = req.url.split('?')[0];
  console.log(req.method, p);
  if (/\/check-suites$/.test(p)) return reply(200, { total_count: 1, check_suites: [{ status: 'completed', conclusion: 'success' }] });
  const m = p.match(/^\/repos\/o\/r\/pulls\/(\d+)(\/files)?$/);
  if (!m) return reply(404, { message: 'Not Found' });
  if (m[2]) return reply(200, []);
  return reply(200, { number: Number(m[1]), merged: false, head: { sha: head, ref: 'b' }, base: { ref: 'main' } });
}).listen(Number(port), '127.0.0.1');

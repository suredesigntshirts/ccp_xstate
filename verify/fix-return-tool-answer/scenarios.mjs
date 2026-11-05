// The same returns, made through the real hook and the real return-tool server of a checkout, recorded so that the
// head's record can be compared with main's (Expect unchanged and stamped-accepted). Every run uses the same fixed
// folder and fixed commit dates, so paths, shas and hashes agree between checkouts. `node scenarios.mjs <checkout>`
// prints the record; run on a checkout of main (762e2c1) it gave evidence/main-scenarios.json.
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { stubGitHub, atBuild, ret, toVerify, textOf, PR_URL } from './lib.mjs';

const FIXED = join(tmpdir(), 'verify-rta-fixed');
// A journal row as compared: without its own id and time.
const plain = ({ id, at, ...row }) => row;

export async function scenarios(repo) {
  const gh = await stubGitHub();
  const out = { hook: {}, server: {}, rows: [], results: {} };
  try {
    const p = await atBuild(repo, gh, { at: FIXED });
    const head = p.commit();
    gh.state.head = head;
    const good = { pr: { url: PR_URL, at: head }, notes: 'clamp added' };
    const as = (agent, result, tu) => p.hook({ hook_event_name: 'PreToolUse', agent_id: agent, tool_name: 'mcp__plugin_ccp-harness_harness__return', tool_use_id: tu, tool_input: { run: p.run, result } });
    out.hook.wrongCaller = await as('intruder', good, 'tu-1');
    out.hook.schema = await ret(p, { pr: { url: PR_URL, at: head.slice(0, 7) } }, 'tu-2');
    out.hook.reserved = await ret(p, { pr: { url: PR_URL, at: head, key: 'o/r#1' } }, 'tu-3');
    out.hook.refMismatch = await ret(p, { pr: { url: PR_URL, at: 'f'.repeat(40) } }, 'tu-4');
    out.server.beforeAccept = textOf(await p.call({ run: p.run, result: good }));
    out.hook.accepted = await ret(p, good, 'tu-5');
    out.server.accepted = textOf(await p.call({ run: p.run, result: good }));
    out.hook.alreadyReturned = await ret(p, good, 'tu-6');
    const { sent, at, ...stored } = p.resultJson();
    out.results.build = stored;
    const v = await toVerify(p);
    const verdict = v.verdict();
    out.hook.verifyAccepted = await v.send(verdict);
    out.server.verifyAccepted = textOf(await p.call({ run: v.run, result: verdict }));
    const { sent: s2, at: a2, ...stored2 } = v.resultJson();
    out.results.verify = stored2;
    out.rows = p.rows().filter((r) => r.kind === 'refusal' || r.kind === 'result.stored').map(plain);
  } finally { await gh.close(); }
  return out;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) console.log(JSON.stringify(await scenarios(process.argv[2]), null, 1));

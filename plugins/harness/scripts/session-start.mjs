#!/usr/bin/env node
// SessionStart hook. In a project that installed the harness, it journals one session.fingerprint row and one
// session.selfcheck row to <journal>/sessions/<session>.jsonl, then tells the session in one line whether the
// self-check passed, naming each failed check in one plain sentence. Without the marker, or with
// CCP_HARNESS_DISABLED=1, it exits 0 with no output and writes nothing.
// It must never get in the session's way: it swallows every failure, always exits 0, and a watchdog ends it
// within about 4 s, inside the hook's 5 s timeout.
import { join } from 'node:path';
import { gate, journal, journalDir, pluginRoot, sessionFile, sessionName, stdin } from './host.mjs';
import { collect, fingerprint } from './fingerprint.mjs';
import { selfcheck, summary } from './selfcheck.mjs';

const WATCHDOG_MS = 4000;

const say = (text) => {
  if (text) {
    process.stdout.write(`${JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: text } })}\n`);
  }
  process.exit(0);
};

let pending = null; // what to say if the watchdog fires once the gate has said installed
setTimeout(() => say(pending), WATCHDOG_MS).unref();

try {
  if ((await gate()) !== 'installed') say(null);
  pending = 'ccp-harness: the session-start self-check ran out of time, so no fingerprint was journalled for this session.';
  const input = JSON.parse((await stdin(500)) || '{}');
  const root = pluginRoot();
  const facts = await collect({ input, root });
  const result = selfcheck(facts);
  const session = sessionName(input);
  const path = join(journalDir(), 'sessions', sessionFile(session));
  const base = { session, agent: null, item: null, state: null, release: facts.plugin.version };
  const ref = input.session_id || session;
  try {
    const { append } = await journal(root);
    append(path, { ...base, kind: 'session.fingerprint', source: { system: 'claude-code', ref }, payload: fingerprint(facts) });
    result.checks.push({ id: 'journal', status: 'pass', detail: `journalling to ${path}` });
    append(path, { ...base, kind: 'session.selfcheck', source: { system: 'hook', ref: `SessionStart ${ref}` }, payload: result });
  } catch (error) {
    result.passed = false;
    result.checks.push({ id: 'journal', status: 'fail', detail: `The journal at ${path} could not be written (${error.message}), so this session's rows are lost.` });
  }
  say(summary(result, facts.plugin));
} catch (error) {
  say(`ccp-harness: the session-start self-check crashed (${error.message}), so nothing was journalled for this session.`);
}


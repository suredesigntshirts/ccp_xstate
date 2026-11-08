// What the verifier's tests share: wakes built as the platform writes them, and bin/host.js wake driven with a hook
// input on stdin against a quick-fix item's journal file.
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { toAwaitingMerge, rowsOf, A } from '../../test/regression/lib.mjs';

const cli = new URL('../../packages/engine/bin/host.js', import.meta.url).pathname;

/** One wake, platform-shaped: <wake> at column zero, each <event> line indented, its JSON on its own line. */
export const wakeOf = (events, { reason = 'external-event', time = '2026-10-30T17:02:44Z' } = {}) =>
  `<wake reason="${reason}" current-time="${time}">\n` +
  events.map(({ kind, body }) => `  <event source="github" kind="${kind}" from="system" trust="relay" untrusted-keys="check,title,summary,details_url">\n    <!-- The following CI check failed on the PR. -->\n    ${body}\n  </event>\n`).join('') +
  `</wake>\n`;

export const checkData = (title) => ({ check: 'test', check_run_id: 7, conclusion: 'failure', details_url: 'https://github.com/o/r/actions/runs/9/job/1', head_sha: A, pr: 'o/r#1', title });

/** An item in awaitingMerge on head A, its journal root, and a wake runner over bin/host.js. */
export async function item() {
  const { root } = await toAwaitingMerge();
  const wake = (prompt) => {
    const out = spawnSync('node', [cli, 'wake', '--item', 'it-1', '--workflow', 'quick-fix', '--root', root, '--release', '0.2.0'],
      { input: JSON.stringify({ session_id: 'owner', hook_event_name: 'UserPromptSubmit', prompt }), encoding: 'utf8' });
    assert.equal(out.status, 0, out.stderr);
    return JSON.parse(out.stdout);
  };
  return { root, wake, rows: () => rowsOf(root) };
}

/**
 * The engine.transition rows for a GitHub event that are in rows but not in before. Rows are compared by id, not by
 * position: the journal reads rows in time order, and a GitHub event's row carries the wake's time.
 */
export const githubTransitions = (rows, before) => {
  const seen = new Set(before.map((r) => r.id));
  return rows.filter((r) => !seen.has(r.id) && r.kind === 'engine.transition' && r.source?.system === 'github');
};

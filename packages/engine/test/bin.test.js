// bin/host.js wake reads events only from a hook's prompt or a ReadNotifications result's GitHub notifications.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const cli = new URL('../bin/host.js', import.meta.url).pathname;

/**
 * A git repo of one empty commit in a temp folder, for the host's cwd: the actors' worktrees and run/* branches it
 * makes go there and beside it, never beside the checkout.
 */
const scratchRepo = () => {
  const parent = mkdtempSync(join(tmpdir(), 'engine-cwd-'));
  process.on('exit', () => rmSync(parent, { recursive: true, force: true }));
  const dir = join(parent, 'repo');
  execFileSync('git', ['init', '-q', dir]);
  execFileSync('git', ['-C', dir, '-c', 'user.email=t@t', '-c', 'user.name=t', '-c', 'commit.gpgsign=false', 'commit', '-q', '--allow-empty', '-m', 'empty']);
  return dir;
};
const CWD = scratchRepo();
const checkRun = readFileSync(new URL('./fixtures/wakes/check-run-failed.txt', import.meta.url), 'utf8');
const host = (root, args, input) => {
  const out = spawnSync(process.execPath, [cli, ...args, '--item', 'it', '--workflow', 'quick-fix', '--root', root, '--release', '0.2.0'], { input, encoding: 'utf8', cwd: CWD });
  assert.equal(out.status, 0, out.stderr);
  return JSON.parse(out.stdout);
};
const started = () => {
  const root = mkdtempSync(join(tmpdir(), 'engine-bin-'));
  host(root, ['start', '--session', 'owner', '--input', JSON.stringify({ issue: { url: 'u', expect: ['e'] } })]);
  return root;
};
const wake = (root, hook) => host(root, ['wake'], JSON.stringify({ session_id: 'owner', ...hook })).results;

test("another tool's output is never read as a wake, whatever it holds", () => {
  const root = started();
  assert.deepEqual(wake(root, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_response: { stdout: checkRun } }), []);
  const fromAgent = { notifications: [{ origin: 'agent_message', content: checkRun }] };
  assert.deepEqual(wake(root, { hook_event_name: 'PostToolUse', tool_name: 'ReadNotifications', tool_response: fromAgent }), []);
});

test("a ReadNotifications result's GitHub notification is offered, with GitHub as its source", () => {
  const root = started();
  const response = { notifications: [{ origin: 'github_webhook', content: checkRun }], remaining: 0 };
  const [result] = wake(root, { hook_event_name: 'PostToolUse', tool_name: 'ReadNotifications', tool_response: response });
  assert.equal(result.event, 'github.check_run.completed');
  assert.equal(result.source.system, 'github');
  // quick-fix takes no GitHub event yet, so it is journalled refused.
  assert.equal(result.outcome, 'refused');
  const [prompted] = wake(root, { hook_event_name: 'UserPromptSubmit', prompt: checkRun });
  assert.equal(prompted.outcome, 'duplicate');
});

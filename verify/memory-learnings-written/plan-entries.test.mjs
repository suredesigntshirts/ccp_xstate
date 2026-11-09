// platform-rows, defects-filed: the platform facts are ledger rows in the ledger's row format, and each defect the audit
// filed is named in a plan item; the plan check passes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { REPO, read, sections, lacking } from './lib.mjs';

const ROWS = {
  'L-prompt-swap-updatedinput': ['PreToolUse', 'updatedInput', 'Agent', 'prompt', 'no `permissionDecision`', 'claude -p', 'allow'],
  'L-subagentstart-in-line': ['SubagentStart', 'waits', 'transcript may not be written yet'],
  'L-named-agent-tools': ['named agent', '`tools` list', 'no ToolSearch', 'pickedEffortModel'],
  'L-headless-auth-and-memory': ['claude -p --bare', 'API key', 'CLAUDE_CODE_DISABLE_AUTO_MEMORY=1', 'memory off']
};

test('each platform fact is a ledger row with Lesson, Evidence and Fate', () => {
  const rows = sections('plan/ledger/platform.md', '###');
  for (const [id, terms] of Object.entries(ROWS)) {
    assert.ok(id in rows, `no row ${id}`);
    const lines = rows[id].trim().split('\n');
    assert.deepEqual(lines.map((l) => l.match(/^\*\*(\w+):\*\*/)?.[1]), ['Lesson', 'Evidence', 'Fate'], id);
    assert.match(lines[2], /^\*\*Fate:\*\* (design|setup|test|tolerate)\b/, id);
    assert.deepEqual(lacking(rows[id], terms), [], id);
  }
});

const item = (id) => read(`plan/items/${id}.md`);
const head = (id) => JSON.parse(item(id).match(/```json\n([\s\S]*?)\n```/)[1]);

test('the derive.js bugs are an item of their own', () => {
  const h = head('derive-view-gaps');
  assert.equal(h.id, 'derive-view-gaps');
  assert.deepEqual(lacking(item('derive-view-gaps'), ['derive.js overhead', 'Claude-Session trailer', 'derive.js time',
    'prompt', 'CI', 'derive.js rework', 'readying replan']), []);
});

test('the rest of section D and the helper-file observation are lines in refine-leftovers', () => {
  assert.deepEqual(lacking(item('refine-leftovers'), [
    'scripts/inspector/page.html', 'long hash',
    'workflows/quick-fix/build.md', "Never put anything but the PR's url in pr", '{ url, at }',
    'resolve()', 'leanClone', 'setup.sh',
    'helper `.mjs`', 'test files only', 'childEnv',
    '/mnt/project-files', 'scripts/'
  ]), []);
});

test('node plan/check.mjs passes', () => {
  const out = execFileSync('node', [join(REPO, 'plan/check.mjs')], { cwd: REPO, encoding: 'utf8' });
  assert.match(out, /plan ok/);
});

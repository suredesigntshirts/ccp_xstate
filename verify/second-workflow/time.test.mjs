// time: a gap waits on the person only when its wake carries the person's own message or tap, and on CI when the
// wake brings a GitHub check result. Rows are made by capture itself from hook inputs, then given their times.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { capture } from '../../plugins/harness/scripts/capture-rows.mjs';
import { append } from '../../packages/journal/src/index.js';

const derive = new URL('../../packages/journal/bin/derive.js', import.meta.url).pathname;
const S = 'https://claude.ai/code/session_01TTTTTTTTTTTTTTTTTTTTTTTT';
const T0 = Date.parse('2026-11-11T08:00:00Z');
const MIN = 60_000;

/** A session's rows: each step is [minute, hook input]; capture makes the rows, each stamped at its minute. */
function journalOf(steps) {
  const file = join(mkdtempSync(join(tmpdir(), 'verify-time-')), 'session.jsonl');
  let state = {};
  let n = 0;
  for (const [minute, input] of steps) {
    const got = capture({ session_id: 'local', ...input }, { read: () => null, state, newId: () => `id-${n++}` });
    state = got.state;
    for (const row of got.rows) append(file, { session: S, item: null, state: null, release: '0.9.0', at: new Date(T0 + minute * MIN).toISOString(), ...row });
  }
  return file;
}
const time = (file) => JSON.parse(execFileSync(process.execPath, [derive, 'time', '--journal', file], { encoding: 'utf8' })).sessions[S];
const wake = (prompt) => ({ hook_event_name: 'UserPromptSubmit', prompt });
const stop = { hook_event_name: 'Stop' };

const human = (reason, body = 'please also add a test') => `<wake reason="${reason}" current-time="2026-11-11T08:10:00Z">
  <project id="chan_1" type="project"><thread ts="cmsg_T">
    <message trigger="true" from="human" trust="principal" author="Dana" id="cmsg_M1" sent-at="2026-11-11T08:09:59Z">${body}</message>
  </thread></project>
</wake>`;
const tap = `<wake reason="decision-chosen" current-time="2026-11-11T08:10:00Z">
  <project id="chan_1" type="project"><thread ts="cmsg_T">
    <message trigger="true" from="human" trust="principal" author="Dana" id="cmsg_M2">Approve</message>
  </thread></project>
  <system-note>decision_id=cmsg_CARD</system-note><system-note>option_index=0</system-note><system-note>option=Approve</system-note>
</wake>`;
const github = (kind) => `<wake reason="external-event" current-time="2026-11-11T08:10:00Z">
  <event source="github" kind="${kind}" from="system" trust="relay">
    {"head_sha":"${'a'.repeat(40)}","pr":"o/r#1"}
  </event>
</wake>`;
const relay = `A message from this project's coordinator session.\n<coordinator-relay>\n<relay from="coordinator" session="s">\n<cited author="user" name="Dana">do the thing</cited>\n<note>Start on the item.</note>\n</relay>\n</coordinator-relay>`;
const bareStatus = `<wake reason="thread-computer-status" current-time="2026-11-11T08:10:00Z">
  <project id="chan_1" type=""><thread ts="cmsg_T"></thread></project>
  <system-note>status=not_linked</system-note>
</wake>`;

// One turn (minute 0 to 1), a gap to minute 10 ended by `prompt`, and its turn (10 to 11): the gap's label.
const labelOf = (prompt) => {
  const s = time(journalOf([[0, wake(human('mention'))], [1, stop], [10, wake(prompt)], [11, stop]]));
  assert.equal(s.gaps.length, 1);
  assert.equal(s.gaps[0].ms, 9 * MIN);
  return s;
};

test("a wake carrying the person's own message waits on the person", () => {
  const s = labelOf(human('mention'));
  assert.equal(s.gaps[0].label, 'person');
  assert.deepEqual(s.waitingMs, { person: 9 * MIN, ci: 0, wake: 0, rebuild: 0 });
});

test("a decision tap waits on the person", () => {
  assert.equal(labelOf(tap).gaps[0].label, 'person');
});

for (const kind of ['check_run.completed', 'check_suite.completed']) {
  test(`a wake bringing GitHub ${kind} waits on CI`, () => {
    const s = labelOf(github(kind));
    assert.equal(s.gaps[0].label, 'ci');
    assert.equal(s.waitingMs.ci, 9 * MIN);
  });
}

for (const [what, text] of [
  ["a coordinator's relay (no wake envelope)", relay],
  ["a headless driver's prompt", 'ccp-run it:0.brief'],
  ['a GitHub event that is not a check (a PR closing)', github('pull_request.closed')],
  ['a platform wake with no person in it', bareStatus]
]) {
  test(`${what} is a wake, not the person`, () => {
    const s = labelOf(text);
    assert.equal(s.gaps[0].label, 'wake');
    assert.equal(s.waitingMs.person, 0);
    assert.equal(s.waitingMs.ci, 0);
  });
}

test('old wake rows with reason prompt and no checkEvent field read as a wake', () => {
  const file = join(mkdtempSync(join(tmpdir(), 'verify-time-')), 'old.jsonl');
  const row = (minute, kind, payload) => append(file, { session: S, item: null, state: null, release: '0.1.30', agent: null, at: new Date(T0 + minute * MIN).toISOString(), kind, source: { system: 'claude-code', ref: `r${minute}` }, payload, ...(kind === 'turn.usage' ? { placeholder: 'old' } : {}) });
  const tokens = { tokens: { input: 1, output: 1, cacheRead: 0, cacheCreation: 0 }, messages: 1, models: [], cost: null, fiveHour: null, sevenDay: null };
  row(0, 'wake', { reason: 'prompt', source: 'user', hash: 'h', bytes: 1 });
  row(1, 'turn.usage', tokens);
  row(10, 'wake', { reason: 'prompt', source: 'user', hash: 'h', bytes: 1 });
  row(11, 'turn.usage', tokens);
  row(20, 'wake', { reason: 'external-event', source: 'hearth', hash: 'h', bytes: 1 });
  row(21, 'turn.usage', tokens);
  const s = time(file);
  assert.deepEqual(s.gaps.map((g) => g.label), ['wake', 'wake']);
  assert.equal(s.workingMs + s.waitingMs.wake, s.wallMs);
});

test("the person's rows are matched to their own wake only: a later bare wake is not the person's", () => {
  const s = time(journalOf([[0, wake(human('mention'))], [1, stop], [10, wake(relay)], [11, stop], [20, wake(human('mention'))], [21, stop], [30, wake(github('check_run.completed'))], [31, stop]]));
  assert.deepEqual(s.gaps.map((g) => g.label), ['wake', 'person', 'ci']);
  assert.equal(s.workingMs + s.waitingMs.person + s.waitingMs.ci + s.waitingMs.wake + s.waitingMs.rebuild + s.unknownMs, s.wallMs);
});

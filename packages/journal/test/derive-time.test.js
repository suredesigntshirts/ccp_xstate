// The time view (plan item obs-time-and-rework, Expect `time`): idle gaps are waiting or unknown, never working, and
// the parts sum to wall-clock time. The fixture is a real session's journal (one turn with a subagent), with a
// second turn copied after it so that a 10-minute idle gap sits between them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { time } from '../src/derive/time.js';

const real = readFileSync(new URL('./fixtures/derive/session.jsonl', import.meta.url), 'utf8')
  .trim().split('\n').map((l) => JSON.parse(l));
const TEN_MIN = 10 * 60 * 1000;
const t = (iso) => Date.parse(iso);
const shift = (row, by, n) => ({ ...row, id: `${row.id}-${n}`, at: new Date(t(row.at) + by).toISOString() });

// The real session, then its turn (the wake and every row after it) again, starting 10 minutes after the first turn's
// last activity. A turn's activity starts with the capture hook that writes its wake row, just before the row. The
// second wake can carry a reason, a recorded check event, and the person row capture writes with it in the same
// UserPromptSubmit run, in this session or another.
const alone = Object.values(time(real).sessions)[0];
const firstStart = alone.gaps[0].to;
function withGap({ reason = 'mention', checkEvent, person = null, personSession = null, fingerprint = null } = {}) {
  const wake = real.find((r) => r.kind === 'wake');
  const turn = real.filter((r) => t(r.at) >= t(wake.at));
  const by = t(alone.to) - t(firstStart) + TEN_MIN;
  const second = turn.map((r) => shift(r, by, 2));
  const secondWake = second.find((r) => r.kind === 'wake');
  secondWake.payload = { ...secondWake.payload, reason, source: 'hearth' };
  if (reason === null) delete secondWake.payload.reason;
  if (checkEvent !== undefined) secondWake.payload.checkEvent = checkEvent;
  let personRow = null;
  if (person) {
    personRow = person === 'tap'
      ? { kind: 'person.tap', source: { system: 'hearth', ref: 'cmsg_card' }, payload: { thread: 'cmsg_t', cardId: 'cmsg_card', option: 'A', optionIndex: 0, sentAt: secondWake.at, authorId: 'user_1' } }
      : { kind: 'person.message', source: { system: 'hearth', ref: 'cmsg_m' }, payload: { thread: 'cmsg_t', messageId: 'cmsg_m', reason, trigger: true, surface: null, sentAt: secondWake.at, authorId: 'user_1', hash: 'h', bytes: 5 } };
    personRow = { ...secondWake, ...personRow, id: `${secondWake.id}-person`, agent: null, session: personSession ?? secondWake.session };
    second.splice(second.indexOf(secondWake) + 1, 0, personRow);
  }
  const extra = [];
  if (fingerprint !== null) {
    const fp = real.find((r) => r.kind === 'session.fingerprint');
    extra.push({ ...fp, id: `${fp.id}-resume`, at: new Date(t(firstStart) + by - fingerprint).toISOString(), payload: { ...fp.payload, start: 'resume' } });
  }
  return { rows: [...real, ...second, ...extra], secondWake, personRow, gapEnd: new Date(t(firstStart) + by).toISOString() };
}
const sessionOf = (rows) => time(rows).sessions[real[0].session];
const tenMinGap = (s) => s.gaps.find((g) => g.ms === TEN_MIN);

const sums = (s) => s.workingMs + Object.values(s.waitingMs).reduce((a, b) => a + b, 0) + s.unknownMs;

test('the real session alone: working, plus start-up before the first wake, sums to wall-clock', () => {
  const { sessions } = time(real);
  const [s] = Object.values(sessions);
  assert.equal(sums(s), s.wallMs);
  assert.ok(s.workingMs > 0);
  assert.equal(s.gaps.length, 1);
  assert.equal(s.gaps[0].label, 'rebuild');
});

test('a 10-minute idle gap ended by a mention wake with the person\'s message is waiting on the person, never working', () => {
  const { rows, secondWake, personRow, gapEnd } = withGap({ reason: 'mention', person: 'message' });
  const s = sessionOf(rows);
  const gap = s.gaps.find((g) => g.from === alone.to);
  assert.deepEqual([gap.to, gap.ms, gap.label, gap.reason, gap.inputs], [gapEnd, TEN_MIN, 'person', 'mention', [secondWake.id, personRow.id]]);
  assert.equal(s.waitingMs.person, TEN_MIN);
  assert.equal(s.workingMs, 2 * alone.workingMs);
  assert.equal(sums(s), s.wallMs);
});

test('a decision-chosen wake with the person\'s tap is waiting on the person', () => {
  const { rows, secondWake, personRow } = withGap({ reason: 'decision-chosen', person: 'tap' });
  const s = sessionOf(rows);
  assert.deepEqual([tenMinGap(s).label, tenMinGap(s).inputs], ['person', [secondWake.id, personRow.id]]);
  assert.equal(s.waitingMs.person, TEN_MIN);
  assert.equal(sums(s), s.wallMs);
});

test('a wake with no person row of its own session is not waiting on the person, whatever its reason', () => {
  for (const opts of [{ reason: 'mention' }, { reason: 'decision-chosen' }, { reason: 'mention', person: 'message', personSession: 'another-session' }, { reason: 'decision-chosen', person: 'tap', personSession: 'another-session' }]) {
    const s = sessionOf(withGap(opts).rows);
    assert.equal(tenMinGap(s).label, 'wake', JSON.stringify(opts));
    assert.equal(s.waitingMs.person, 0, JSON.stringify(opts));
    assert.equal(sums(s), s.wallMs);
  }
});

test('a wake that records a GitHub check_run or check_suite event is waiting on CI; another external event is not', () => {
  // checkEvent as capture records it on the wake row for each GitHub event kind.
  for (const [kind, checkEvent, label] of [['check_run.completed', true, 'ci'], ['check_suite.completed', true, 'ci'], ['issues.edited', false, 'wake'], ['pull_request.closed', false, 'wake']]) {
    const { rows, secondWake } = withGap({ reason: 'external-event', checkEvent });
    const s = sessionOf(rows);
    assert.deepEqual([tenMinGap(s).label, tenMinGap(s).reason, tenMinGap(s).inputs], [label, 'external-event', [secondWake.id]], kind);
    assert.equal(s.waitingMs.ci, label === 'ci' ? TEN_MIN : 0);
    assert.equal(sums(s), s.wallMs);
  }
  // An external-event wake from before capture recorded check events is not ci either.
  assert.equal(tenMinGap(sessionOf(withGap({ reason: 'external-event' }).rows)).label, 'wake');
});

test('a prompt wake is a wake; other reasons are wakes; a wake with no reason makes the gap unknown', () => {
  for (const [reason, label] of [['prompt', 'wake'], ['spawn', 'wake'], ['task-notification', 'wake'], ['agent-message', 'wake'], [null, 'unknown']]) {
    const s = sessionOf(withGap({ reason }).rows);
    assert.equal(tenMinGap(s).label, label, String(reason));
    assert.equal(sums(s), s.wallMs);
    if (label === 'unknown') assert.equal(s.unknownMs, TEN_MIN);
    if (label === 'wake') assert.equal(s.waitingMs.wake, TEN_MIN);
  }
});

test('a SessionStart inside the gap splits its tail off as rebuild', () => {
  const s = sessionOf(withGap({ reason: 'mention', person: 'message', fingerprint: 60_000 }).rows);
  assert.equal(s.waitingMs.person, TEN_MIN - 60_000);
  assert.equal(s.waitingMs.rebuild - alone.waitingMs.rebuild, 60_000);
  assert.equal(sums(s), s.wallMs);
});

test('a turn that never closed leaves the gap after it unknown, and rows read twice count once', () => {
  const { rows } = withGap({ reason: 'mention', person: 'message' });
  const open = rows.filter((r) => !(r.kind === 'turn.usage' && !r.id.endsWith('-2')));
  const [s] = Object.values(time([...open, ...open]).sessions);
  const gap = s.gaps.find((g) => g.ms >= TEN_MIN);
  assert.equal(gap.label, 'unknown');
  assert.equal(gap.reason, 'the turn before it never closed');
  assert.equal(sums(s), s.wallMs);
});

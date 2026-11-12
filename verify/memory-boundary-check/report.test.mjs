// The report against the committed listings: each snapshot it names is a listing whose counts agree, both
// observed items and their threads are named, and each trap the observed threads met is named with a home that
// holds it, or the report says why it is not a trap.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../../', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');
const report = read('plan/research/memory-boundary-check.md');
const dir = 'plan/research/memory-boundary-check';
const notes = { 'docs/traps.md': read('docs/traps.md'), 'docs/verifying.md': read('docs/verifying.md') };

// The section of a notes file that holds every term, or null.
function sectionWith(text, terms) {
  return text.split(/\n(?=## )/).find((s) => terms.every((t) => s.includes(t))) ?? null;
}

test('each committed listing is named in the report with its session, sync time and entry count', () => {
  const files = readdirSync(join(root, dir)).filter((f) => f.endsWith('.json'));
  assert.ok(files.length >= 3, 'a before, an after-prune and a last snapshot');
  for (const f of files) {
    const l = JSON.parse(read(join(dir, f)));
    assert.equal(l.store_entries, l.files.length, `${f}: entry count matches its file list`);
    for (const e of l.files) {
      assert.match(e.sha256, /^[0-9a-f]{64}$/, `${f}: ${e.name} has a sha-256`);
      assert.ok(Number.isInteger(e.size) && /^mem_/.test(e.entry), `${f}: ${e.name} has a size and entry id`);
      assert.equal(Object.keys(e).sort().join(), 'entry,name,sha256,size', `${f}: names, sizes and hashes only`);
    }
    const row = report.split('\n').find((r) => r.includes(f));
    assert.ok(row, `report names ${f}`);
    assert.ok(row.includes(l.session) || (row.includes('same session') && report.includes(l.session)),
      `${f}: report row names its session`);
    assert.ok(row.includes(l.synced_at.slice(11, 19)), `${f}: report row names its sync time`);
    assert.ok(row.includes(`| ${l.store_entries} |`), `${f}: report row names its entry count`);
  }
});

test('the report names both observed items and their threads', () => {
  assert.match(report, /### 1\. memory-boundary-check/);
  assert.match(report, /### 2\. second-workflow/);
  for (const t of ['session_01KfkB5JV6vrEnQts7qCrK4X',
    'cmsg_01VhYV3jhQ9s4qrrh2th12sNWnUTYuH9V5sYfU3qRE4N7M',
    'cmsg_01VhYV3jhQ9s4qrrh2th12sNBALxb61puq7VezRGda1a9D']) assert.ok(report.includes(t), `report names ${t}`);
});

// Every trap the observed threads named in their replies or PRs, with the words its home must hold.
const traps = [
  { what: 'stale origin/main', report: 'origin/main', home: ['origin/main', 'fetch'] },
  { what: 'ci run with no jobs', report: 'no jobs', home: ['no jobs', 'Re-run'] },
  { what: 'draft PR stops the merge', report: 'draft', home: ['draft PR', 'merge'] },
  { what: 'self-modification refusal', report: 'self-modification', home: ['self-modification'] },
  { what: 'release command refused', report: 'release command', home: ['What a thread may not do to GitHub'] },
  // plan/decisions/2026-11-11-second-workflow-run.md: a host run from the checkout records the repo's release.
  { what: 'host.js from the checkout needs --release', report: '--release', home: ['host.js', '--release'] },
];

for (const t of traps) {
  test(`trap homed: ${t.what}`, () => {
    assert.ok(report.includes(t.report), `report names the trap (${t.report})`);
    const homed = Object.values(notes).some((n) => sectionWith(n, t.home));
    const line = report.split('\n').find((r) => r.includes(t.report)) ?? '';
    assert.ok(homed || /not a trap/i.test(line), 'a notes file section holds it, or the report says why it is not a trap');
  });
}

test('the delete-shape platform fact is in the platform ledger', () => {
  assert.ok(report.includes('L-memory-delete-shape'));
  assert.ok(read('plan/ledger/platform.md').includes('L-memory-delete-shape'));
});

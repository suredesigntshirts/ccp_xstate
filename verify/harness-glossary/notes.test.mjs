// no-translation: scripts/inspector/export.mjs no longer says a capture row is not a harness accept or a host prompt,
// and tells capture rows from engine rows by kind alone. claude-md: CLAUDE.md names docs/language.md, carries the line
// to use its terms and add one before a new term, and stays under 100 lines (the path check is verify/repo-skeleton/claude-md.test.mjs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const EXPORT = readFileSync(join(REPO, 'scripts/inspector/export.mjs'), 'utf8');

test('no-translation: the capture-row notes are gone', () => {
  for (const re of [/not a harness accept/i, /a hash, not a/i, /capture's own (result|brief)\.stored/i, /host prompt/i, /not the harness accepting/i]) assert.doesNotMatch(EXPORT, re);
  // The capture rows the page explains are named by their own kinds.
  const what = EXPORT.match(/const TRACE_WHAT = \{([\s\S]*?)\};/)[1];
  assert.match(what, /'agent\.final'/);
  assert.match(what, /'agent\.prompt'/);
  assert.doesNotMatch(what, /stored/);
});

test('no-translation: capture rows and engine rows are told apart by kind, not by payload shape', () => {
  // Main told them apart by payload: a brief.stored with contextHash was the host's prompt, one with no run the capture's.
  assert.doesNotMatch(EXPORT, /kind === 'brief\.stored'[^\n]*contextHash/);
  assert.doesNotMatch(EXPORT, /kind === 'brief\.stored'[^\n]*!r\.payload\?\.run/);
  assert.match(EXPORT, /r\.kind === 'prompt\.stored' && r\.payload\?\.run === runId\)/);
  assert.match(EXPORT, /r\.kind === 'agent\.prompt' && \(r\.agent === agentId/);
  // Rows are read through the journal's upcast, so older rows arrive in today's kinds.
  assert.match(EXPORT, /import \{ upcast \} from '\.\.\/\.\.\/packages\/journal\/src\/index\.js'/);
});

test('claude-md: names docs/language.md, says to use its terms and add one first, under 100 lines', () => {
  const md = readFileSync(join(REPO, 'CLAUDE.md'), 'utf8');
  const lines = md.split('\n');
  assert.ok(lines.length < 100, `${lines.length} lines`);
  assert.ok(lines.some((l) => l.startsWith('| `docs/`') && l.includes('`docs/language.md`')), 'in the layout table');
  const rule = lines.find((l) => l.includes('docs/language.md') && /Principles|^- \*\*/.test(l));
  assert.ok(rule, 'a principle line names it');
  assert.match(rule, /[Uu]se the terms/);
  assert.match(rule, /add a line there before introducing a new one/);
});

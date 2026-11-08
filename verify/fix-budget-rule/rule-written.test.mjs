// rule-written: plan/README.md has a Fix budget section stating the rule; CLAUDE.md points at it and stays under
// 100 lines; docs/language.md defines fix budget and design item.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPO } from './lib.mjs';

const read = (p) => readFileSync(join(REPO, p), 'utf8');

test('plan/README.md Fix budget section states the four parts of the rule', () => {
  const md = read('plan/README.md');
  const m = md.match(/\n## Fix budget\n([\s\S]*?)\n## /);
  assert.ok(m, 'no ## Fix budget section');
  const s = m[1].replace(/\s+/g, ' ');
  assert.match(s, /`fix-` item names the one module/);              // a fix item names its module
  assert.match(s, /three fix items naming the same module were done in the last 14 days/);
  assert.match(s, /no design item for that module was done after them, a fourth fix item there is refused/);
  assert.match(s, /design item[^.]*names that module[^.]*\. It names the concept that keeps breaking in `concepts` and designs it twice/);
  assert.match(s, /Once it is done, the module's count starts again/);
  assert.match(md, /a fix item over the fix budget/);               // the check list names it
  assert.match(md, /\| `module`, `done_on` \|/);                     // the head-field table names the fields
  console.log(m[1].trim());
});

test('CLAUDE.md points at the fix budget and stays under 100 lines', () => {
  const md = read('CLAUDE.md');
  const lines = md.split('\n').length - (md.endsWith('\n') ? 1 : 0);
  assert.ok(lines < 100, `${lines} lines`);
  assert.match(md.replace(/\s+/g, ' '), /Step back, don't grind\.\*\*[^*]*`plan\/README\.md`, "Fix budget"/);
  console.log('CLAUDE.md lines:', lines);
});

test('docs/language.md defines fix budget and design item', () => {
  const md = read('docs/language.md');
  const fb = md.split('\n').find((l) => l.startsWith('| fix budget |'));
  const di = md.split('\n').find((l) => l.startsWith('| design item |'));
  assert.ok(fb && /Three done fix items naming one module in 14 days/.test(fb), fb);
  assert.ok(di && /designs it twice/.test(di) && /restarts/.test(di), di);
  console.log(fb + '\n' + di);
});

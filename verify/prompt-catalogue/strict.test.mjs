// Expect strict (plan item prompt-catalogue): the renderer refuses a missing or extra value and any tag but a plain
// slot, naming the entry; a malformed catalogue is refused at load naming the line; nothing is HTML-escaped.
// Verifier's own malformed entries and values; the builder's tests are not used.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, load, render } from '../../packages/engine/src/messages.js';

const FENCE = '```';
const entry = (name, template, note = 'when it is sent') => `## ${name}\n\n${note}\n${FENCE}\n${template}\n${FENCE}\n`;
const cat = (...es) => `# Messages\n\nPreamble.\n\n${es.join('\n')}`;

test('strict: a render with a missing slot value is refused, naming the entry and the slot', () => {
  const c = catalogue(cat(entry('greet-run', 'Run {{run}} of {{item}}.')));
  assert.equal(c.render('greet-run', { run: 'r', item: 'i' }), 'Run r of i.');
  assert.throws(() => c.render('greet-run', { run: 'r' }), (e) => /greet-run/.test(e.message) && /item/.test(e.message));
  assert.throws(() => c.render('greet-run'), /greet-run/);
});

test('strict: a value no slot names is refused, naming the entry and the value', () => {
  const c = catalogue(cat(entry('greet-run', 'Run {{run}}.')));
  assert.throws(() => c.render('greet-run', { run: 'r', extra: 'x' }), (e) => /greet-run/.test(e.message) && /extra/.test(e.message));
  assert.throws(() => catalogue(cat(entry('plain', 'No slots.'))).render('plain', { a: '1' }), /plain/);
});

test('strict: an unknown entry is refused, naming it', () => {
  assert.throws(() => render('no-such-entry-xyz', {}), /no-such-entry-xyz/);
});

for (const [kind, template] of [
  ['section', 'A {{#list}}x{{/list}} b'],
  ['inverted section', 'A {{^list}}none{{/list}} b'],
  ['partial', 'A {{> other}} b'],
  ['comment', 'A {{! a note }} b'],
  ['unescaped triple', 'A {{{raw}}} b'],
  ['ampersand', 'A {{& raw}} b'],
  ['delimiter change', 'A {{=<% %>=}} <% x %> b'],
  ['dotted name', 'A {{a.b}} b']
]) {
  test(`strict: a template using a ${kind} is refused, naming the entry`, () => {
    assert.throws(() => {
      const c = catalogue(cat(entry('ok-one', 'fine {{x}}'), entry('bad-one', template)));
      c.render('bad-one', { list: 'x', raw: 'x', x: 'x', a: 'x' });
    }, (e) => /bad-one/.test(e.message), template);
  });
}

test('strict: a duplicate entry name is refused at load, naming the line', () => {
  const text = cat(entry('twice', 'one'), entry('twice', 'two'));
  const line = text.split('\n').lastIndexOf('## twice') + 1;
  assert.throws(() => catalogue(text, 'm.md'), (e) => e.message.includes(`m.md:${line}`) && /twice/.test(e.message) && /duplicate/i.test(e.message));
});

test('strict: an empty entry is refused at load, naming the line', () => {
  for (const body of ['', '   ', '\n']) {
    const text = cat(entry('first', 'x'), entry('hollow', body));
    assert.throws(() => catalogue(text, 'm.md'), (e) => /m\.md:\d+/.test(e.message) && /hollow/.test(e.message), JSON.stringify(body));
  }
  // A heading with no template at all.
  const text = `${cat(entry('first', 'x'))}\n## bare\n\n## next\n${FENCE}\ny\n${FENCE}\n`;
  assert.throws(() => catalogue(text, 'm.md'), (e) => /m\.md:\d+/.test(e.message) && /bare/.test(e.message));
});

test('strict: < and & and quotes in a value are not HTML-escaped', () => {
  const c = catalogue(cat(entry('esc', 'a {{v}} b')));
  assert.equal(c.render('esc', { v: '<b>&amp; "q" \'s\' `t` =' }), 'a <b>&amp; "q" \'s\' `t` = b');
  assert.equal(render('unknown-run', { run: '<x&y>' }), 'unknown-run: no prepared run <x&y>');
});

test('strict: the harness catalogue itself loads, and every entry uses plain slots only', () => {
  const c = load();
  assert.equal(c.entries.size >= 100, true);
  for (const e of c.entries.values()) assert.equal(/\{\{\s*[#^/>!=&{]/.test(e.template), false, e.name);
});

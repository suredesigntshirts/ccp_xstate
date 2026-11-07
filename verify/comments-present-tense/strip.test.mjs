// The scanner behind code-unchanged, tested on the inputs a naive stripper gets wrong.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { strip } from './strip.mjs';

test('comments go, code stays', () => {
  assert.equal(strip('a = 1; // x\nb = 2; /* y */ c'), 'a = 1;\nb = 2; c');
});
test('comment markers inside strings stay', () => {
  assert.equal(strip(`s = "// not"; t = '/* no */';`), `s = "// not"; t = '/* no */';`);
  assert.equal(strip(`s = "a\\"// b";`), `s = "a\\"// b";`);
});
test('templates, nested ${} and strings inside them', () => {
  const src = 'x = `a // ${ {b: `in ${ "}" } // t`}.b } /* z */`; // gone';
  assert.equal(strip(src), 'x = `a // ${ {b: `in ${ "}" } // t`}.b } /* z */`;');
});
test('regex literals with slashes and comment-like text', () => {
  assert.equal(strip('r = /\\/\\/ x/g; // c'), 'r = /\\/\\/ x/g;');
  assert.equal(strip('r = /[/*]/; q'), 'r = /[/*]/; q');
  assert.equal(strip('if (x) return /a\\/b/.test(s) // c'), 'if (x) return /a\\/b/.test(s)');
  assert.equal(strip('f(/x/, /y/) // c'), 'f(/x/, /y/)');
});
test('division is not a regex', () => {
  assert.equal(strip('a = b / c / d; // e'), 'a = b / c / d;');
  assert.equal(strip('a = (b) / 2 /* q */ / 3'), 'a = (b) / 2 / 3');
  assert.equal(strip('a = x[1] / y // z'), 'a = x[1] / y');
});
test('a comment rewrapped over different lines strips the same, a code change does not', () => {
  const a = 'f(); // one two\n// three\ng();';
  const b = 'f(); // one\n// two three four\ng();';
  assert.equal(strip(a), strip(b));
  assert.notEqual(strip('f(); // x\ng(1);'), strip('f(); // x\ng(2);'));
  assert.notEqual(strip('s = "a // b";'), strip('s = "a // c";'));
});
test('shebang goes', () => {
  assert.equal(strip('#!/usr/bin/env node\nx'), '\nx');
});

'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { add, subtract, multiply } = require('../math.js');

test('add sums two numbers', () => {
  assert.equal(add(2, 3), 5);
  assert.equal(add(-1, 1), 0);
});

test('subtract returns the difference', () => {
  assert.equal(subtract(5, 3), 2);
});

test('multiply returns the product', () => {
  assert.equal(multiply(2, 3), 6);
  assert.equal(multiply(-2, 3), -6);
});

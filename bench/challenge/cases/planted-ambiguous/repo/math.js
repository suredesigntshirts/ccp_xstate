'use strict';

/** Sum of two numbers. */
function add(a, b) {
  return a + b;
}

/** Difference of two numbers. */
function subtract(a, b) {
  return a - b;
}

/** Product of two numbers. */
function multiply(a, b) {
  return a * b;
}

/** Mean of a list of numbers. */
function average(xs) {
  return xs.reduce((sum, x) => sum + x, 0) / xs.length;
}

module.exports = { add, subtract, multiply, average };

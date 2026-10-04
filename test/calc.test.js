// Tests for the calculator engine. Run with: npm test (or node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, round, format } = require('../js/calc.js');

test('operator order', async (t) => {
  await t.test('multiplication before addition', () => {
    assert.equal(evaluate([2, '+', 3, '*', 4]), 14);
    assert.equal(evaluate([2, '*', 3, '+', 4]), 10);
  });
  await t.test('division before subtraction', () => {
    assert.equal(evaluate([10, '-', 6, '/', 2]), 7);
  });
  await t.test('same precedence runs left to right', () => {
    assert.equal(evaluate([10, '-', 3, '-', 2]), 5);
    assert.equal(evaluate([100, '/', 10, '/', 2]), 5);
    assert.equal(evaluate([8, '/', 2, '*', 4]), 16);
  });
  await t.test('mixed precedence in one expression', () => {
    assert.equal(evaluate([1, '+', 2, '*', 3, '-', 4, '/', 2]), 5);
  });
});

test('chained operations', async (t) => {
  await t.test('long chain of additions', () => {
    assert.equal(evaluate([1, '+', 2, '+', 3, '+', 4, '+', 5]), 15);
  });
  await t.test('continuing from a previous result', () => {
    const first = evaluate([5, '*', 5]);
    assert.equal(first, 25);
    assert.equal(evaluate([first, '-', 5, '/', 5]), 24);
  });
  await t.test('single number evaluates to itself', () => {
    assert.equal(evaluate([42]), 42);
  });
  await t.test('negative operands', () => {
    assert.equal(evaluate([-3, '*', 4]), -12);
    assert.equal(evaluate([2, '-', 5]), -3);
  });
});

test('divide by zero', async (t) => {
  await t.test('throws a readable error', () => {
    assert.throws(() => evaluate([5, '/', 0]), { message: 'Cannot divide by zero' });
  });
  await t.test('throws when zero divisor is inside a longer expression', () => {
    assert.throws(() => evaluate([1, '+', 5, '/', 0]), { message: 'Cannot divide by zero' });
  });
  await t.test('throws when the divisor computes to zero', () => {
    assert.throws(() => evaluate([6, '/', 3, '/', 0]), { message: 'Cannot divide by zero' });
  });
  await t.test('zero divided by a number is zero', () => {
    assert.equal(evaluate([0, '/', 5]), 0);
  });
});

test('decimals', async (t) => {
  await t.test('basic decimal arithmetic', () => {
    assert.equal(evaluate([1.5, '+', 2.25]), 3.75);
    assert.equal(evaluate([2.5, '*', 4]), 10);
    assert.equal(evaluate([7, '/', 2]), 3.5);
  });
  await t.test('repeating decimals are cut to 12 significant digits', () => {
    assert.equal(evaluate([1, '/', 3]), 0.333333333333);
    assert.equal(evaluate([2, '/', 3]), 0.666666666667);
  });
});

test('floating point rounding', async (t) => {
  await t.test('0.1 + 0.2 is 0.3', () => {
    assert.equal(evaluate([0.1, '+', 0.2]), 0.3);
  });
  await t.test('other classic float noise cases', () => {
    assert.equal(evaluate([0.3, '-', 0.1]), 0.2);
    assert.equal(evaluate([1.1, '*', 3]), 3.3);
    assert.equal(evaluate([0.7, '+', 0.1]), 0.8);
    assert.equal(evaluate([4.35, '*', 100]), 435);
  });
  await t.test('round() strips noise and leaves non-finite values alone', () => {
    assert.equal(round(0.1 + 0.2), 0.3);
    assert.equal(round(Infinity), Infinity);
    assert.ok(Number.isNaN(round(NaN)));
  });
});

test('display formatting', async (t) => {
  await t.test('plain numbers', () => {
    assert.equal(format(14), '14');
    assert.equal(format(0.1 + 0.2), '0.3');
    assert.equal(format(-3.5), '-3.5');
  });
  await t.test('very large and very small numbers use exponent form', () => {
    assert.equal(format(123456789012345678), '1.23456789e+17');
    assert.equal(format(1e21), '1e+21');
    assert.equal(format(0.000000123456789), '1.23456789e-7');
  });
  await t.test('non-finite values show Error', () => {
    assert.equal(format(Infinity), 'Error');
    assert.equal(format(NaN), 'Error');
  });
});

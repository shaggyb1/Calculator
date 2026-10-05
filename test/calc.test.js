// Tests for the calculator engine. Run with: npm test (or node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { evaluate, round, format, calculate } = require('../js/calc.js');

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

test('scientific expressions', async (t) => {
  await t.test('parentheses and powers', () => {
    assert.equal(calculate('2*(3+4)'), 14);
    assert.equal(calculate('2^10'), 1024);
    assert.equal(calculate('2^3^2'), 512);
    assert.equal(calculate('-2^2'), -4);
    assert.equal(calculate('(-2)^2'), 4);
  });
  await t.test('implicit multiplication', () => {
    assert.equal(calculate('2(3+4)'), 14);
    assert.equal(calculate('(1+1)(2+3)'), 10);
    assert.equal(calculate('2π'), round(2 * Math.PI));
  });
  await t.test('missing closing parentheses are filled in', () => {
    assert.equal(calculate('2*(3+4'), 14);
    assert.equal(calculate('sin(30'), 0.5);
  });
  await t.test('roots, factorial and percent', () => {
    assert.equal(calculate('√16'), 4);
    assert.equal(calculate('sqrt(2)^2'), 2);
    assert.equal(calculate('cbrt(27)'), 3);
    assert.equal(calculate('5!'), 120);
    assert.equal(calculate('0!'), 1);
    assert.equal(calculate('200*15%'), 30);
  });
  await t.test('logs and constants', () => {
    assert.equal(calculate('log(1000)'), 3);
    assert.equal(calculate('ln(e)'), 1);
    assert.equal(calculate('e^0'), 1);
    assert.equal(calculate('abs(-7)'), 7);
  });
  await t.test('display symbols are accepted', () => {
    assert.equal(calculate('6×7−2÷2'), 41);
  });
  await t.test('Ans and scientific notation', () => {
    assert.equal(calculate('Ans+1', { ans: 41 }), 42);
    assert.equal(calculate('1.5E-7*2'), 3e-7);
  });
});

test('trigonometry', async (t) => {
  await t.test('degrees by default, exact at special angles', () => {
    assert.equal(calculate('sin(30)'), 0.5);
    assert.equal(calculate('cos(60)'), 0.5);
    assert.equal(calculate('tan(45)'), 1);
    assert.equal(calculate('sin(180)'), 0);
    assert.equal(calculate('cos(90)'), 0);
    assert.equal(calculate('asin(1)'), 90);
  });
  await t.test('radians', () => {
    const rad = { angle: 'rad' };
    assert.equal(calculate('sin(π/2)', rad), 1);
    assert.equal(calculate('sin(π)', rad), 0);
    assert.equal(calculate('acos(-1)', rad), round(Math.PI));
  });
});

test('scientific errors', async (t) => {
  const err = (expr, message) => assert.throws(() => calculate(expr), { message });
  await t.test('divide by zero', () => {
    err('10/0', 'Cannot divide by zero');
    err('0^(-1)', 'Cannot divide by zero');
  });
  await t.test('out of domain', () => {
    err('√-4', 'Invalid input');
    err('log(0)', 'Invalid input');
    err('asin(2)', 'Invalid input');
    err('tan(90)', 'Invalid input');
    err('(-1)!', 'Invalid input');
    err('2.5!', 'Invalid input');
  });
  await t.test('malformed input', () => {
    err('2+', 'Invalid expression');
    err('', 'Invalid expression');
    err('2)', 'Invalid expression');
    err('hello', 'Invalid expression');
  });
});

test('float noise does not break domains', () => {
  assert.equal(calculate('(0.1+0.2)*10!'), round(0.3 * 3628800));
  assert.equal(calculate('((0.1+0.2)*10/3)!'), 1);
  assert.equal(calculate('asin(0.1*10+0.2-0.2)'), 90);
});

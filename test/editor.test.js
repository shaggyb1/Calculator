// Tests for the keypad number editor used by the converter and GST screens.
const test = require('node:test');
const assert = require('node:assert/strict');
const ExprEditor = require('../js/editor.js');

function type(ed, keys) { for (const k of keys) ed.press(k); return ed; }

test('the first digit replaces the starting value', () => {
  const ed = ExprEditor('1');
  type(ed, ['2', '5']);
  assert.equal(ed.text, '25');
  assert.equal(ed.value(), 25);
});

test('sums work and a trailing operator is ignored', () => {
  const ed = type(ExprEditor('0'), ['1', '2', '*', '3']);
  assert.equal(ed.value(), 36);
  ed.press('+');
  assert.equal(ed.value(), 36);
  ed.press('=');
  assert.equal(ed.text, '36');
});

test('sign, backspace and clear', () => {
  const ed = type(ExprEditor('0'), ['4', '2', 'sign']);
  assert.equal(ed.value(), -42);
  type(ed, ['sign', 'back']);
  assert.equal(ed.text, '4');
  ed.press('AC');
  assert.equal(ed.value(), 0);
});

test('one decimal point per number', () => {
  const ed = type(ExprEditor('0'), ['.', '5', '.', '5']);
  assert.equal(ed.text, '0.55');
});

test('= on an unfinished entry reports an error', () => {
  let errors = 0;
  const ed = ExprEditor('0', () => errors++);
  type(ed, ['sign', '=']);
  assert.equal(errors, 1);
});

test('unknown keys are not handled', () => {
  assert.equal(ExprEditor('0').press('sin'), false);
});

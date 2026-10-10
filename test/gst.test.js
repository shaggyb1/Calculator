// Tests for the GST maths. Run with: npm test (or node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const { calc, RATES } = require('../js/gst.js');

test('add GST', () => {
  assert.deepEqual(calc(1000, 18, 'add'), { base: 1000, gst: 180, cgst: 90, sgst: 90, total: 1180 });
  assert.deepEqual(calc(250, 5, 'add'), { base: 250, gst: 12.5, cgst: 6.25, sgst: 6.25, total: 262.5 });
  assert.equal(calc(100, 0, 'add').total, 100);
});

test('remove GST from an inclusive price', () => {
  assert.deepEqual(calc(1180, 18, 'remove'), { base: 1000, gst: 180, cgst: 90, sgst: 90, total: 1180 });
  assert.deepEqual(calc(1400, 40, 'remove'), { base: 1000, gst: 400, cgst: 200, sgst: 200, total: 1400 });
});

test('amounts round to paise and the split always adds up', () => {
  const r = calc(99.99, 18, 'add');
  assert.equal(r.gst, 18);
  assert.equal(r.total, 117.99);
  for (const rate of RATES) {
    for (const amt of [0.01, 0.05, 1, 9.99, 123.45, 100000]) {
      for (const mode of ['add', 'remove']) {
        const x = calc(amt, rate, mode);
        assert.equal(Math.round((x.cgst + x.sgst) * 100), Math.round(x.gst * 100), `${amt} @ ${rate}% ${mode}`);
        assert.equal(Math.round((x.base + x.gst) * 100), Math.round(x.total * 100), `${amt} @ ${rate}% ${mode}`);
      }
    }
  }
});

test('odd paise split CGST and SGST by at most one paisa', () => {
  const r = calc(0.25, 18, 'add'); // GST 0.045 -> 0.05
  assert.equal(r.gst, 0.05);
  assert.equal(r.cgst + r.sgst, 0.05);
});

test('bad input throws', () => {
  assert.throws(() => calc(NaN, 18, 'add'));
  assert.throws(() => calc(100, -1, 'add'));
});

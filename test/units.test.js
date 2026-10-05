// Tests for the unit converter engine. Run with: npm test (or node --test)
const test = require('node:test');
const assert = require('node:assert/strict');
const units = require('../js/units.js');
const { convert } = units;

test('simple multiples', async (t) => {
  await t.test('length', () => {
    assert.equal(convert('length', 1, 'ft', 'cm'), 30.48);
    assert.equal(convert('length', 1, 'mi', 'km'), 1.609344);
    assert.equal(convert('length', 12, 'in', 'ft'), 1);
  });
  await t.test('area', () => {
    assert.equal(convert('area', 1, 'ha', 'm2'), 10000);
    assert.equal(convert('area', 1, 'ac', 'ft2'), 43560);
  });
  await t.test('volume', () => {
    assert.equal(convert('volume', 1, 'gal', 'l'), 3.785411784);
    assert.equal(convert('volume', 3, 'tsp', 'tbsp'), 1);
  });
  await t.test('weight', () => {
    assert.equal(convert('weight', 1, 'lb', 'oz'), 16);
    assert.equal(convert('weight', 1, 'kg', 'g'), 1000);
  });
  await t.test('speed', () => {
    assert.equal(convert('speed', 36, 'kmh', 'mps'), 10);
    assert.equal(convert('speed', 60, 'mph', 'kmh'), 96.56064);
  });
  await t.test('time and data', () => {
    assert.equal(convert('time', 2, 'h', 'min'), 120);
    assert.equal(convert('data', 1, 'GiB', 'MiB'), 1024);
    assert.equal(convert('data', 1, 'B', 'bit'), 8);
  });
  await t.test('floating point noise is rounded away', () => {
    assert.equal(convert('length', 0.1, 'ft', 'm'), 0.03048);
  });
});

test('non-linear units', async (t) => {
  await t.test('temperature', () => {
    assert.equal(convert('temperature', 100, 'c', 'f'), 212);
    assert.equal(convert('temperature', -40, 'f', 'c'), -40);
    assert.equal(convert('temperature', 0, 'k', 'c'), -273.15);
    assert.equal(convert('temperature', 98.6, 'f', 'c'), 37);
  });
  await t.test('fuel economy', () => {
    assert.equal(convert('fuel', 20, 'kml', 'l100'), 5);
    assert.equal(convert('fuel', 5, 'l100', 'kml'), 20);
    assert.ok(Math.abs(convert('fuel', 10, 'mpg', 'l100') - 23.5214583) < 1e-6);
  });
  await t.test('no answer gives NaN', () => {
    assert.ok(Number.isNaN(convert('fuel', 0, 'kml', 'l100')));
  });
});

test('angle', () => {
  assert.equal(convert('angle', 180, 'deg', 'rad'), units.round(Math.PI));
  assert.equal(convert('angle', 1, 'turn', 'grad'), 400);
});

test('currency', async (t) => {
  await t.test('uses built-in rates by default', () => {
    assert.equal(convert('currency', 1, 'USD', 'INR'), units.DEFAULT_RATES.INR);
    assert.equal(units.getRates().live, false);
  });
  await t.test('live rates replace built-in ones and keep missing ones', () => {
    units.setRates({ USD: 1, INR: 100, XYZ: 5, EUR: -1 }, 'Live', true);
    assert.equal(convert('currency', 2, 'USD', 'INR'), 200);
    assert.equal(convert('currency', 100, 'INR', 'USD'), 1);
    assert.equal(convert('currency', 1, 'USD', 'EUR'), units.DEFAULT_RATES.EUR);
    assert.equal(units.unit('currency', 'XYZ'), null);
    assert.equal(units.getRates().live, true);
    units.setRates(units.DEFAULT_RATES, null, false);
  });
});

test('every category converts a value there and back', () => {
  for (const c of units.categories) {
    assert.ok(units.unit(c, c.from) && units.unit(c, c.to), c.id + ' default units exist');
    for (const a of c.units) {
      for (const b of c.units) {
        const there = convert(c.id, 7, a.id, b.id);
        const back = convert(c.id, there, b.id, a.id);
        assert.ok(Math.abs(back - 7) < 1e-6, `${c.id}: ${a.id} -> ${b.id} -> ${a.id} gave ${back}`);
      }
    }
  }
});

test('bad input throws', () => {
  assert.throws(() => convert('nope', 1, 'a', 'b'), /Unknown category/);
  assert.throws(() => convert('length', 1, 'm', 'parsec'), /Unknown unit/);
});

// Unit conversion engine: pure data and functions, no DOM. Works in the browser and in Node.
//
// Each unit either has a `factor` (how many base units one of it is) or a
// `to`/`from` pair for units that aren't a simple multiple (temperature, fuel use).
(function (root) {
  'use strict';

  function u(id, name, symbol, factor) {
    return { id: id, name: name, symbol: symbol, factor: factor };
  }

  // Approximate built-in exchange rates (units per 1 US dollar), used when
  // offline or before live rates have been fetched.
  var DEFAULT_RATES = {
    USD: 1, EUR: 0.86, GBP: 0.75, INR: 88.5, JPY: 148, CNY: 7.12, AUD: 1.52, CAD: 1.39,
    CHF: 0.80, SGD: 1.29, HKD: 7.78, NZD: 1.71, AED: 3.6725, SAR: 3.75, ZAR: 17.4,
    BRL: 5.35, MXN: 18.4, KRW: 1395, RUB: 82, TRY: 41.5, SEK: 9.4, NOK: 10, THB: 32.3,
    IDR: 16500, MYR: 4.22, PHP: 57.5, PKR: 282, BDT: 122, LKR: 302, NPR: 141.6
  };
  var DEFAULT_RATES_LABEL = 'Built-in approximate rates (2026)';

  var CURRENCY_NAMES = {
    USD: 'US dollar', EUR: 'Euro', GBP: 'British pound', INR: 'Indian rupee', JPY: 'Japanese yen',
    CNY: 'Chinese yuan', AUD: 'Australian dollar', CAD: 'Canadian dollar', CHF: 'Swiss franc',
    SGD: 'Singapore dollar', HKD: 'Hong Kong dollar', NZD: 'New Zealand dollar', AED: 'UAE dirham',
    SAR: 'Saudi riyal', ZAR: 'South African rand', BRL: 'Brazilian real', MXN: 'Mexican peso',
    KRW: 'South Korean won', RUB: 'Russian ruble', TRY: 'Turkish lira', SEK: 'Swedish krona',
    NOK: 'Norwegian krone', THB: 'Thai baht', IDR: 'Indonesian rupiah', MYR: 'Malaysian ringgit',
    PHP: 'Philippine peso', PKR: 'Pakistani rupee', BDT: 'Bangladeshi taka', LKR: 'Sri Lankan rupee',
    NPR: 'Nepalese rupee'
  };

  var CATEGORIES = [
    { id: 'length', name: 'Length', units: [
      u('mm', 'Millimetre', 'mm', 0.001), u('cm', 'Centimetre', 'cm', 0.01), u('m', 'Metre', 'm', 1),
      u('km', 'Kilometre', 'km', 1000), u('um', 'Micrometre', 'µm', 1e-6),
      u('in', 'Inch', 'in', 0.0254), u('ft', 'Foot', 'ft', 0.3048), u('yd', 'Yard', 'yd', 0.9144),
      u('mi', 'Mile', 'mi', 1609.344), u('nmi', 'Nautical mile', 'nmi', 1852)
    ], from: 'm', to: 'ft' },
    { id: 'area', name: 'Area', units: [
      u('mm2', 'Square millimetre', 'mm²', 1e-6), u('cm2', 'Square centimetre', 'cm²', 1e-4),
      u('m2', 'Square metre', 'm²', 1), u('ha', 'Hectare', 'ha', 1e4), u('km2', 'Square kilometre', 'km²', 1e6),
      u('in2', 'Square inch', 'in²', 0.00064516), u('ft2', 'Square foot', 'ft²', 0.09290304),
      u('yd2', 'Square yard', 'yd²', 0.83612736), u('ac', 'Acre', 'ac', 4046.8564224),
      u('mi2', 'Square mile', 'mi²', 2589988.110336)
    ], from: 'm2', to: 'ft2' },
    { id: 'volume', name: 'Volume', units: [
      u('ml', 'Millilitre', 'mL', 0.001), u('l', 'Litre', 'L', 1), u('m3', 'Cubic metre', 'm³', 1000),
      u('tsp', 'Teaspoon (US)', 'tsp', 0.00492892159375), u('tbsp', 'Tablespoon (US)', 'tbsp', 0.01478676478125),
      u('floz', 'Fluid ounce (US)', 'fl oz', 0.0295735295625), u('cup', 'Cup (US)', 'cup', 0.2365882365),
      u('pt', 'Pint (US)', 'pt', 0.473176473), u('qt', 'Quart (US)', 'qt', 0.946352946),
      u('gal', 'Gallon (US)', 'gal', 3.785411784), u('galuk', 'Gallon (UK)', 'gal UK', 4.54609),
      u('in3', 'Cubic inch', 'in³', 0.016387064), u('ft3', 'Cubic foot', 'ft³', 28.316846592)
    ], from: 'l', to: 'gal' },
    { id: 'weight', name: 'Weight', units: [
      u('mg', 'Milligram', 'mg', 1e-6), u('g', 'Gram', 'g', 0.001), u('kg', 'Kilogram', 'kg', 1),
      u('t', 'Tonne', 't', 1000), u('ct', 'Carat', 'ct', 0.0002), u('tola', 'Tola', 'tola', 0.0116638038),
      u('oz', 'Ounce', 'oz', 0.028349523125), u('lb', 'Pound', 'lb', 0.45359237),
      u('st', 'Stone', 'st', 6.35029318), u('ton', 'Short ton (US)', 'ton', 907.18474),
      u('lt', 'Long ton (UK)', 'LT', 1016.0469088)
    ], from: 'kg', to: 'lb' },
    { id: 'temperature', name: 'Temperature', units: [
      { id: 'c', name: 'Celsius', symbol: '°C', to: function (v) { return v; }, from: function (v) { return v; } },
      { id: 'f', name: 'Fahrenheit', symbol: '°F', to: function (v) { return (v - 32) * 5 / 9; }, from: function (v) { return v * 9 / 5 + 32; } },
      { id: 'k', name: 'Kelvin', symbol: 'K', to: function (v) { return v - 273.15; }, from: function (v) { return v + 273.15; } }
    ], from: 'c', to: 'f' },
    { id: 'speed', name: 'Speed', units: [
      u('mps', 'Metres per second', 'm/s', 1), u('kmh', 'Kilometres per hour', 'km/h', 1 / 3.6),
      u('mph', 'Miles per hour', 'mph', 0.44704), u('kn', 'Knot', 'kn', 1852 / 3600),
      u('fps', 'Feet per second', 'ft/s', 0.3048)
    ], from: 'kmh', to: 'mph' },
    { id: 'time', name: 'Time', units: [
      u('ms', 'Millisecond', 'ms', 0.001), u('s', 'Second', 's', 1), u('min', 'Minute', 'min', 60),
      u('h', 'Hour', 'h', 3600), u('d', 'Day', 'd', 86400), u('wk', 'Week', 'wk', 604800),
      u('mo', 'Month (average)', 'mo', 2629800), u('yr', 'Year (365.25 d)', 'yr', 31557600)
    ], from: 'h', to: 'min' },
    { id: 'data', name: 'Data', units: [
      u('bit', 'Bit', 'bit', 0.125), u('B', 'Byte', 'B', 1),
      u('KB', 'Kilobyte', 'KB', 1e3), u('MB', 'Megabyte', 'MB', 1e6), u('GB', 'Gigabyte', 'GB', 1e9),
      u('TB', 'Terabyte', 'TB', 1e12), u('PB', 'Petabyte', 'PB', 1e15),
      u('KiB', 'Kibibyte', 'KiB', 1024), u('MiB', 'Mebibyte', 'MiB', 1048576),
      u('GiB', 'Gibibyte', 'GiB', 1073741824), u('TiB', 'Tebibyte', 'TiB', 1099511627776)
    ], from: 'GB', to: 'MB' },
    { id: 'pressure', name: 'Pressure', units: [
      u('pa', 'Pascal', 'Pa', 1), u('kpa', 'Kilopascal', 'kPa', 1000), u('mpa', 'Megapascal', 'MPa', 1e6),
      u('bar', 'Bar', 'bar', 1e5), u('atm', 'Atmosphere', 'atm', 101325),
      u('psi', 'Pounds per sq inch', 'psi', 6894.757293168), u('mmhg', 'Millimetre of mercury', 'mmHg', 133.322387415),
      u('inhg', 'Inch of mercury', 'inHg', 3386.389)
    ], from: 'psi', to: 'bar' },
    { id: 'energy', name: 'Energy', units: [
      u('j', 'Joule', 'J', 1), u('kj', 'Kilojoule', 'kJ', 1000), u('cal', 'Calorie', 'cal', 4.184),
      u('kcal', 'Kilocalorie', 'kcal', 4184), u('wh', 'Watt-hour', 'Wh', 3600), u('kwh', 'Kilowatt-hour', 'kWh', 3.6e6),
      u('btu', 'British thermal unit', 'BTU', 1055.05585262), u('ev', 'Electronvolt', 'eV', 1.602176634e-19)
    ], from: 'kcal', to: 'kj' },
    { id: 'power', name: 'Power', units: [
      u('w', 'Watt', 'W', 1), u('kw', 'Kilowatt', 'kW', 1000), u('mw', 'Megawatt', 'MW', 1e6),
      u('hp', 'Horsepower', 'hp', 745.69987158227), u('ps', 'Metric horsepower', 'PS', 735.49875),
      u('btuh', 'BTU per hour', 'BTU/h', 0.29307107017)
    ], from: 'kw', to: 'hp' },
    { id: 'angle', name: 'Angle', units: [
      u('deg', 'Degree', '°', 1), u('rad', 'Radian', 'rad', 180 / Math.PI), u('grad', 'Gradian', 'grad', 0.9),
      u('arcmin', 'Arcminute', '′', 1 / 60), u('arcsec', 'Arcsecond', '″', 1 / 3600), u('turn', 'Turn', 'turn', 360)
    ], from: 'deg', to: 'rad' },
    { id: 'fuel', name: 'Fuel economy', units: [
      u('kml', 'Kilometres per litre', 'km/L', 1),
      { id: 'l100', name: 'Litres per 100 km', symbol: 'L/100 km', to: function (v) { return 100 / v; }, from: function (v) { return 100 / v; } },
      u('mpg', 'Miles per gallon (US)', 'mpg', 1.609344 / 3.785411784),
      u('mpguk', 'Miles per gallon (UK)', 'mpg UK', 1.609344 / 4.54609)
    ], from: 'kml', to: 'l100' },
    { id: 'currency', name: 'Currency', units: [], from: 'USD', to: 'INR' }
  ];

  var byId = {};
  CATEGORIES.forEach(function (c) { byId[c.id] = c; });

  var rates = { values: DEFAULT_RATES, label: DEFAULT_RATES_LABEL, live: false };

  // Replace the currency rates (units per 1 USD). Unknown or bad values are skipped;
  // currencies missing from `values` keep their previous rate.
  function setRates(values, label, live) {
    var merged = {};
    Object.keys(rates.values).forEach(function (k) { merged[k] = rates.values[k]; });
    Object.keys(values || {}).forEach(function (k) {
      if (CURRENCY_NAMES[k] && typeof values[k] === 'number' && values[k] > 0) merged[k] = values[k];
    });
    rates = { values: merged, label: label || DEFAULT_RATES_LABEL, live: !!live };
    byId.currency.units = Object.keys(CURRENCY_NAMES).map(function (code) {
      return u(code, CURRENCY_NAMES[code], code, 1 / merged[code]);
    });
  }
  setRates(DEFAULT_RATES, DEFAULT_RATES_LABEL, false);

  function getRates() { return rates; }

  function category(id) { return byId[id] || null; }

  function unit(cat, id) {
    var c = typeof cat === 'string' ? byId[cat] : cat;
    if (!c) return null;
    for (var i = 0; i < c.units.length; i++) if (c.units[i].id === id) return c.units[i];
    return null;
  }

  // Round away floating point noise, e.g. 0.1 ft -> 0.03048 m, not 0.030480000000000004.
  function round(n) {
    if (!isFinite(n)) return n;
    return parseFloat(n.toPrecision(12));
  }

  // convert('length', 1, 'ft', 'cm') -> 30.48
  // Returns NaN when the conversion has no answer (e.g. 0 km/L in L/100 km).
  function convert(catId, value, fromId, toId) {
    var c = byId[catId];
    if (!c) throw new Error('Unknown category: ' + catId);
    var from = unit(c, fromId), to = unit(c, toId);
    if (!from || !to) throw new Error('Unknown unit');
    if (fromId === toId) return round(value);
    var base = from.to ? from.to(value) : value * from.factor;
    var out = to.from ? to.from(base) : base / to.factor;
    return isFinite(out) ? round(out) : NaN;
  }

  var api = {
    categories: CATEGORIES, category: category, unit: unit, convert: convert, round: round,
    setRates: setRates, getRates: getRates, DEFAULT_RATES: DEFAULT_RATES
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.UnitConvert = api;
})(this);

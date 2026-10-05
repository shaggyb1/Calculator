// Calculator engine: pure functions, no DOM. Works in the browser and in Node.
(function (root) {
  'use strict';

  var PRECEDENCE = { '+': 1, '-': 1, '*': 2, '/': 2 };

  // Round away floating point noise, e.g. 0.1 + 0.2 -> 0.3.
  function round(n) {
    if (!isFinite(n)) return n;
    return parseFloat(n.toPrecision(12));
  }

  // Evaluate a flat token list like [2, '+', 3, '*', 4] with normal operator order.
  // Throws Error('Cannot divide by zero') on division by zero.
  function evaluate(tokens) {
    var values = [];
    var ops = [];

    function apply() {
      var op = ops.pop();
      var b = values.pop();
      var a = values.pop();
      var r;
      if (op === '+') r = a + b;
      else if (op === '-') r = a - b;
      else if (op === '*') r = a * b;
      else {
        if (b === 0) throw new Error('Cannot divide by zero');
        r = a / b;
      }
      values.push(round(r));
    }

    for (var i = 0; i < tokens.length; i++) {
      var t = tokens[i];
      if (typeof t === 'number') {
        values.push(t);
      } else {
        while (ops.length && PRECEDENCE[ops[ops.length - 1]] >= PRECEDENCE[t]) apply();
        ops.push(t);
      }
    }
    while (ops.length) apply();
    return round(values[0]);
  }

  // Format a number for the display.
  function format(n) {
    if (!isFinite(n)) return 'Error';
    var s = String(round(n));
    if (s.length > 14) s = round(n).toExponential(8).replace(/\.?0+e/, 'e');
    return s;
  }

  // ---- Scientific expressions -------------------------------------------
  //
  // calculate('2(3+4)^2 - sin(30)', { angle: 'deg' }) -> 97.5
  //
  // Grammar (lowest to highest precedence):
  //   sum     = product (('+' | '-') product)*
  //   product = unary (('*' | '/') unary | <implicit> unary)*
  //   unary   = ('-' | '+') unary | power
  //   power   = postfix ('^' unary)?            right associative, so -2^2 = -4
  //   postfix = primary ('!' | '%')*
  //   primary = number | 'π' | 'e' | 'Ans' | func '(' sum ')' | '√' unary | '(' sum ')'
  // Missing closing parentheses at the end are filled in, so '2(3+4' works.
  // Numbers may use 'E' for scientific notation (1.5E-7), so lower-case 'e' is
  // always Euler's number.

  var FUNCS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'ln', 'log', 'sqrt', 'cbrt', 'abs'];

  function tokenize(src) {
    var out = [];
    var i = 0;
    while (i < src.length) {
      var ch = src.charAt(i);
      if (/\s/.test(ch)) { i++; continue; }
      var rest = src.slice(i);
      var m = /^(\d+\.?\d*|\.\d+)(E[+-]?\d+)?/.exec(rest);
      if (m) {
        out.push({ type: 'num', value: parseFloat(m[0]) });
        i += m[0].length;
        continue;
      }
      if (rest.indexOf('Ans') === 0) { out.push({ type: 'ans' }); i += 3; continue; }
      var fn = null;
      for (var f = 0; f < FUNCS.length; f++) {
        if (rest.indexOf(FUNCS[f]) === 0) { fn = FUNCS[f]; break; }
      }
      if (fn) { out.push({ type: 'func', value: fn }); i += fn.length; continue; }
      if (ch === 'π' || ch === 'e') { out.push({ type: 'const', value: ch }); i++; continue; }
      if ('+-*/^()!%√'.indexOf(ch) !== -1) { out.push({ type: 'op', value: ch }); i++; continue; }
      if (ch === '×') { out.push({ type: 'op', value: '*' }); i++; continue; }
      if (ch === '÷') { out.push({ type: 'op', value: '/' }); i++; continue; }
      if (ch === '−') { out.push({ type: 'op', value: '-' }); i++; continue; }
      throw new Error('Invalid expression');
    }
    return out;
  }

  function invalid() { return new Error('Invalid input'); }

  // Trig results this close to zero are float noise: sin(180°) is 0, not 1.2e-16.
  function snap(n) { return Math.abs(n) < 1e-12 ? 0 : n; }

  function factorial(n) {
    n = round(n);
    if (n < 0 || n !== Math.floor(n) || n > 170) throw invalid();
    var r = 1;
    for (var k = 2; k <= n; k++) r *= k;
    return r;
  }

  function applyFunc(name, x, deg) {
    var toRad = deg ? Math.PI / 180 : 1;
    x = round(x); // so float noise like 1.0000000000000002 doesn't leave the domain
    switch (name) {
      case 'sin': return snap(Math.sin(x * toRad));
      case 'cos': return snap(Math.cos(x * toRad));
      case 'tan':
        if (deg && Math.abs(x % 180) === 90) throw invalid();
        var t = snap(Math.tan(x * toRad));
        if (Math.abs(t) > 1e15) throw invalid();
        return t;
      case 'asin': if (x < -1 || x > 1) throw invalid(); return Math.asin(x) / toRad;
      case 'acos': if (x < -1 || x > 1) throw invalid(); return Math.acos(x) / toRad;
      case 'atan': return Math.atan(x) / toRad;
      case 'ln': if (x <= 0) throw invalid(); return Math.log(x);
      case 'log': if (x <= 0) throw invalid(); return Math.log10(x);
      case 'sqrt': if (x < 0) throw invalid(); return Math.sqrt(x);
      case 'cbrt': return Math.cbrt(x);
      case 'abs': return Math.abs(x);
    }
    throw new Error('Invalid expression');
  }

  // Evaluate an expression string. options.angle is 'deg' (default) or 'rad';
  // options.ans is the value of 'Ans'. Throws Error with a readable message.
  function calculate(src, options) {
    options = options || {};
    var deg = options.angle !== 'rad';
    var ans = options.ans || 0;
    var tokens = tokenize(String(src));
    var pos = 0;
    if (!tokens.length) throw new Error('Invalid expression');

    function peek() { return tokens[pos]; }
    function isOp(tok, v) { return tok && tok.type === 'op' && tok.value === v; }
    function startsPrimary(tok) {
      return tok && (tok.type !== 'op' || tok.value === '(' || tok.value === '√');
    }
    function expectClose() {
      if (isOp(peek(), ')')) pos++;
      else if (pos < tokens.length) throw new Error('Invalid expression');
      // At the end of input a missing ')' is filled in.
    }

    function sum() {
      var v = product();
      while (isOp(peek(), '+') || isOp(peek(), '-')) {
        var op = tokens[pos++].value;
        var r = product();
        v = op === '+' ? v + r : v - r;
      }
      return v;
    }

    function product() {
      var v = unary();
      for (;;) {
        var tok = peek();
        if (isOp(tok, '*')) { pos++; v = v * unary(); }
        else if (isOp(tok, '/')) {
          pos++;
          var d = unary();
          if (d === 0) throw new Error('Cannot divide by zero');
          v = v / d;
        } else if (startsPrimary(tok)) {
          v = v * unary(); // implicit multiplication: 2π, 3(4), (1+1)(2)
        } else return v;
      }
    }

    function unary() {
      if (isOp(peek(), '-')) { pos++; return -unary(); }
      if (isOp(peek(), '+')) { pos++; return unary(); }
      return power();
    }

    function power() {
      var base = postfix();
      if (isOp(peek(), '^')) {
        pos++;
        var exp = unary();
        if (base === 0 && exp < 0) throw new Error('Cannot divide by zero');
        var r = Math.pow(base, exp);
        if (isNaN(r)) throw invalid();
        return r;
      }
      return base;
    }

    function postfix() {
      var v = primary();
      for (;;) {
        if (isOp(peek(), '!')) { pos++; v = factorial(v); }
        else if (isOp(peek(), '%')) { pos++; v = v / 100; }
        else return v;
      }
    }

    function primary() {
      var tok = tokens[pos++];
      if (!tok) throw new Error('Invalid expression');
      if (tok.type === 'num') return tok.value;
      if (tok.type === 'ans') return ans;
      if (tok.type === 'const') return tok.value === 'π' ? Math.PI : Math.E;
      if (tok.type === 'func') {
        if (!isOp(peek(), '(')) throw new Error('Invalid expression');
        pos++;
        var arg = sum();
        expectClose();
        return applyFunc(tok.value, arg, deg);
      }
      if (tok.value === '√') {
        var x = unary();
        if (x < 0) throw invalid();
        return Math.sqrt(x);
      }
      if (tok.value === '(') {
        var inner = sum();
        expectClose();
        return inner;
      }
      throw new Error('Invalid expression');
    }

    var result = sum();
    if (pos < tokens.length) throw new Error('Invalid expression');
    if (!isFinite(result)) throw new Error('Number too large');
    return round(result);
  }

  var api = {
    evaluate: evaluate, round: round, format: format,
    calculate: calculate, tokenize: tokenize
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalcEngine = api;
})(this);

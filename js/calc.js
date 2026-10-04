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

  var api = { evaluate: evaluate, round: round, format: format };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CalcEngine = api;
})(this);

// A small keypad-driven number editor shared by the converter and GST screens.
// It holds what the user typed (simple sums like 12*3 are allowed) and turns
// it into a number with the calculator engine.
(function (root) {
  'use strict';

  var isNode = typeof module !== 'undefined' && module.exports;
  var engine = isNode ? require('./calc.js') : root.CalcEngine;

  function openParens(src) {
    var n = 0;
    for (var i = 0; i < src.length; i++) {
      if (src[i] === '(') n++;
      else if (src[i] === ')' && n > 0) n--;
    }
    return n;
  }
  function closeAll(src) { return src + new Array(openParens(src) + 1).join(')'); }

  function isPlainNumber(text) { return /^-?(\d+\.?\d*|\.\d+)(E[+-]?\d+)?$/.test(text); }

  // onError is called when '=' is pressed on something that isn't a number yet.
  function ExprEditor(text, onError) {
    var ed = {
      text: typeof text === 'string' && text ? text : '0',
      fresh: true, // the next digit replaces the text
      isPlainNumber: function () { return isPlainNumber(ed.text); },
      // The typed text as a number, ignoring a trailing operator, or null.
      value: function () {
        var src = ed.text.replace(/[+\-*/^(]+$/, '');
        if (!src || src === '-') return null;
        try { return engine.calculate(closeAll(src), { angle: 'deg', ans: 0 }); } catch (e) { return null; }
      },
      // Replace the text with a number; the next digit starts over.
      set: function (n) {
        ed.text = n === null || n === undefined ? '0' : String(n).replace('e', 'E');
        ed.fresh = true;
      },
      press: press,
      paste: paste
    };

    function trailingNumber() {
      var m = /(\d+\.?\d*|\.\d+)(E[+-]?\d*)?$/.exec(ed.text);
      return m ? m[0] : '';
    }
    function endsWithValue() { return /[\d.)%]$/.test(ed.text); }
    function startFresh() {
      if (ed.fresh) { ed.text = ''; ed.fresh = false; }
    }

    var actions = {
      digit: function (d) {
        startFresh();
        var num = trailingNumber();
        if (num === '0') ed.text = ed.text.slice(0, -1);
        else if (num.replace(/\D/g, '').length >= 15) return;
        ed.text += d;
      },
      '.': function () {
        startFresh();
        var num = trailingNumber();
        if (/[.E]/.test(num)) return;
        ed.text += num ? '.' : '0.';
      },
      op: function (op) {
        ed.fresh = false;
        if (op === '-' && (!ed.text || /[*/(]$/.test(ed.text))) { ed.text += '-'; return; }
        ed.text = ed.text.replace(/[+\-*/]+$/, '');
        if (endsWithValue()) ed.text += op;
      },
      '%': function () {
        ed.fresh = false;
        if (endsWithValue()) ed.text += '%';
      },
      '(': function () { startFresh(); ed.text += '('; },
      ')': function () {
        ed.fresh = false;
        if (openParens(ed.text) > 0 && endsWithValue()) ed.text += ')';
      },
      sign: function () {
        ed.fresh = false;
        var t = ed.text;
        if (!t || t === '0') ed.text = '-';
        else if (t === '-') ed.text = '';
        else if (isPlainNumber(t)) ed.text = t.charAt(0) === '-' ? t.slice(1) : '-' + t;
        else if (/^-\(.*\)$/.test(t) && openParens(t.slice(2, -1)) === 0) ed.text = t.slice(2, -1);
        else ed.text = '-(' + closeAll(t) + ')';
      },
      back: function () {
        ed.fresh = false;
        var m = /E[+-]?$/.exec(ed.text);
        ed.text = ed.text.slice(0, m ? -m[0].length : -1);
      },
      AC: function () { ed.text = '0'; ed.fresh = true; },
      '=': function () {
        var v = ed.value();
        if (v === null) { if (onError) onError(); return; }
        ed.set(v);
      }
    };

    var OPS = { '+': 1, '-': 1, '*': 1, '/': 1 };

    // Returns true if the key did something editor-related.
    function press(a) {
      if (/^\d$/.test(a)) actions.digit(a);
      else if (OPS[a]) actions.op(a);
      else if (actions[a]) actions[a]();
      else return false;
      return true;
    }

    // Returns false if the text isn't something the editor accepts.
    function paste(clean) {
      if (!/^[\d.+\-*/()%E]+$/.test(clean)) return false;
      startFresh();
      ed.text += clean;
      return true;
    }

    return ed;
  }

  if (isNode) module.exports = ExprEditor;
  else root.ExprEditor = ExprEditor;
})(this);

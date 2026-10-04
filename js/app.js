// Calculator UI: keeps the expression being typed and wires up buttons and keyboard.
(function () {
  'use strict';

  var engine = window.CalcEngine;
  var SYMBOLS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

  var tokens = [];          // committed numbers and operators, e.g. [2, '+']
  var current = '0';        // number being typed (or shown), as a string
  var awaitingOperand = false; // an operator was just pressed; next digit starts a new number
  var justEvaluated = false;
  var error = false;

  var resultEl = document.getElementById('result');
  var exprEl = document.getElementById('expression');

  function render(exprText) {
    resultEl.textContent = error ? current : formatInput(current);
    exprEl.textContent = exprText !== undefined ? exprText : tokensText(tokens);
    var len = resultEl.textContent.length;
    resultEl.style.fontSize = len > 12 ? '1.6rem' : len > 9 ? '2.2rem' : '';
  }

  function formatInput(s) {
    var neg = s.charAt(0) === '-';
    var parts = (neg ? s.slice(1) : s).split('.');
    var intPart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    if (/e/.test(s)) intPart = parts[0];
    return (neg ? '-' : '') + intPart + (parts.length > 1 ? '.' + parts[1] : '');
  }

  function tokensText(list) {
    return list.map(function (t) {
      return typeof t === 'number' ? formatInput(engine.format(t)) : SYMBOLS[t];
    }).join(' ');
  }

  function lastIsOperator() {
    return tokens.length && typeof tokens[tokens.length - 1] === 'string';
  }

  function clearAll() {
    tokens = [];
    current = '0';
    awaitingOperand = false;
    justEvaluated = false;
    error = false;
  }

  function startFresh() {
    if (error || justEvaluated) {
      var keep = error ? '0' : current;
      clearAll();
      current = keep;
    }
  }

  function inputDigit(d) {
    if (error || justEvaluated) clearAll();
    if (awaitingOperand) { current = '0'; awaitingOperand = false; }
    if (current.replace(/[-.]/g, '').length >= 15) return;
    current = current === '0' ? d : current === '-0' ? '-' + d : current + d;
  }

  function inputDecimal() {
    if (error || justEvaluated) clearAll();
    if (awaitingOperand) { current = '0'; awaitingOperand = false; }
    if (current.indexOf('.') === -1) current += '.';
  }

  function inputOperator(op) {
    startFresh();
    if (awaitingOperand && lastIsOperator()) {
      tokens[tokens.length - 1] = op; // replace the operator just typed
      return;
    }
    tokens.push(parseFloat(current), op);
    // Show the running value so chained operations give live feedback.
    try {
      var partial = engine.evaluate(tokens.slice(0, -1));
      current = engine.format(partial);
    } catch (e) {
      return showError(e.message);
    }
    awaitingOperand = true;
  }

  function equals() {
    if (error) return;
    if (!tokens.length) { justEvaluated = true; return; }
    var list = tokens.concat(awaitingOperand ? [] : [parseFloat(current)]);
    if (typeof list[list.length - 1] === 'string') list.pop();
    var exprText = tokensText(list) + ' =';
    try {
      current = engine.format(engine.evaluate(list));
    } catch (e) {
      return showError(e.message);
    }
    tokens = [];
    awaitingOperand = false;
    justEvaluated = true;
    render(exprText);
    return true;
  }

  function showError(msg) {
    var exprText = tokensText(tokens);
    clearAll();
    error = true;
    current = msg;
    render(exprText);
    return true;
  }

  function backspace() {
    if (error) { clearAll(); return; }
    if (justEvaluated) { justEvaluated = false; return; }
    if (awaitingOperand) return;
    current = current.length > 1 && current !== '-0' ? current.slice(0, -1) : '0';
    if (current === '-') current = '0';
  }

  function toggleSign() {
    if (error) return;
    if (awaitingOperand) { current = '0'; awaitingOperand = false; }
    justEvaluated = false;
    current = current.charAt(0) === '-' ? current.slice(1) : '-' + current;
  }

  function percent() {
    if (error) return;
    justEvaluated = false;
    awaitingOperand = false;
    current = engine.format(engine.round(parseFloat(current) / 100));
  }

  function press(action) {
    var handled;
    if (/^\d$/.test(action)) inputDigit(action);
    else if (action === '.') inputDecimal();
    else if (SYMBOLS[action]) handled = inputOperator(action);
    else if (action === '=') handled = equals();
    else if (action === 'AC') clearAll();
    else if (action === 'back') backspace();
    else if (action === 'sign') toggleSign();
    else if (action === '%') percent();
    if (!handled) render();
  }

  document.querySelector('.keys').addEventListener('click', function (e) {
    var btn = e.target.closest('button');
    if (btn) press(btn.dataset.action);
  });

  var KEYMAP = {
    'Enter': '=', '=': '=', 'Escape': 'AC', 'Delete': 'AC', 'Backspace': 'back',
    'x': '*', 'X': '*', '%': '%', ',': '.'
  };

  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var action = KEYMAP[e.key] || e.key;
    if (e.key === 'F9') action = 'sign';
    if (!/^[\d.]$/.test(action) && !SYMBOLS[action] &&
        ['=', 'AC', 'back', '%', 'sign'].indexOf(action) === -1) return;
    e.preventDefault();
    press(action);
    var btn = document.querySelector('[data-action="' + CSS.escape(action) + '"]');
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(function () { btn.classList.remove('pressed'); }, 120);
    }
  });

  render();
})();

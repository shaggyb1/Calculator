// Calculator UI: builds an expression string, shows a live preview, and keeps
// history, theme and mode. All math lives in js/calc.js.
(function () {
  'use strict';

  var engine = window.CalcEngine;
  var $ = function (id) { return document.getElementById(id); };
  var app = $('app'), display = $('display'), exprEl = $('expr'), outEl = $('out');
  var toastEl = $('toast'), histList = $('histList');

  // ---- Saved settings (storage may be unavailable, e.g. private mode) ----
  function load(key, fallback) {
    try {
      var v = localStorage.getItem('calc.' + key);
      return v === null ? fallback : JSON.parse(v);
    } catch (e) { return fallback; }
  }
  function save(key, value) {
    try { localStorage.setItem('calc.' + key, JSON.stringify(value)); } catch (e) { /* ignore */ }
  }

  var FUNCS = ['asin', 'acos', 'atan', 'sin', 'cos', 'tan', 'ln', 'log', 'sqrt', 'cbrt', 'abs'];
  var BINARY = { '+': 1, '-': 1, '*': 1, '/': 1, '^': 1 };

  var state = {
    expr: '',            // what the user has typed, in engine syntax
    done: false,         // '=' was just pressed; the result is showing
    result: null,        // last result (number)
    error: '',
    angle: load('angle', 'deg'),
    mode: load('mode', 'basic'),
    theme: load('theme', 'auto'),
    history: load('history', [])
  };
  if (!Array.isArray(state.history)) state.history = [];

  // ---- Formatting ----
  function group(numStr) {
    return numStr.replace(/^(\d+)/, function (m) { return m.replace(/\B(?=(\d{3})+(?!\d))/g, ','); });
  }

  function formatNumber(n) {
    var s = engine.format(n);
    if (s === 'Error' || /e/.test(s)) return s.replace('e', ' × 10^').replace('^+', '^');
    var neg = s.charAt(0) === '-';
    return (neg ? '−' : '') + group(neg ? s.slice(1) : s);
  }

  // Engine syntax -> what the user sees.
  var PRETTY = {
    'asin(': 'sin⁻¹(', 'acos(': 'cos⁻¹(', 'atan(': 'tan⁻¹(',
    'sqrt(': '√(', 'cbrt(': '∛(', '*': '×', '/': '÷', '-': '−'
  };
  function pretty(src) {
    var out = '';
    var re = /(asin\(|acos\(|atan\(|sqrt\(|cbrt\()|(\d+\.?\d*|\.\d+)(E[+-]?\d+)?|Ans|[\s\S]/g;
    var m;
    while ((m = re.exec(src))) {
      var t = m[0];
      if (m[1]) out += PRETTY[t];
      else if (m[2]) out += group(m[2]) + (m[3] ? ' × 10^' + m[3].slice(1).replace('+', '') : '');
      else out += PRETTY[t] || t;
    }
    return out;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  function openParens(src) {
    var n = 0;
    for (var i = 0; i < src.length; i++) {
      if (src[i] === '(') n++;
      else if (src[i] === ')' && n > 0) n--;
    }
    return n;
  }

  // ---- Rendering ----
  function render() {
    var ghost = state.done ? '' : new Array(openParens(state.expr) + 1).join(')');
    var shown = state.expr ? pretty(state.expr) : (state.done ? '' : '0');
    exprEl.innerHTML = escapeHtml(shown) +
      (state.done ? ' =' : '') +
      (ghost ? '<span class="ghost">' + ghost + '</span>' : '') +
      '<span class="caret"></span>';

    display.classList.toggle('done', state.done);
    display.classList.toggle('error', !!state.error);

    if (state.error) {
      outEl.textContent = state.error;
    } else if (state.done) {
      outEl.textContent = formatNumber(state.result);
    } else {
      var preview = livePreview();
      outEl.textContent = preview === null ? '' : formatNumber(preview);
    }

    // Shrink long text so it fits.
    var len = shown.length + ghost.length;
    exprEl.style.setProperty('--expr-size', len > 22 ? '1.5rem' : len > 15 ? '1.9rem' : len > 10 ? '2.2rem' : '2.6rem');
    var outLen = outEl.textContent.length;
    outEl.style.setProperty('--out-size', outLen > 16 ? '2rem' : outLen > 11 ? '2.6rem' : '3.4rem');
  }

  // Result of the expression typed so far, or null if it isn't complete yet
  // or is just a single number.
  function livePreview() {
    var src = state.expr;
    if (!src || /^-?(\d+\.?\d*|\.\d+)(E[+-]?\d+)?$/.test(src)) return null;
    try { return engine.calculate(src, { angle: state.angle, ans: state.result || 0 }); }
    catch (e) { return null; }
  }

  // ---- Editing ----
  var lastChar = function () { return state.expr.slice(-1); };
  function endsWithValue() {
    // A number, constant, closing paren or postfix operator ends the expression.
    return /[\d.)πe!%]$|Ans$/.test(state.expr) && !/E[+-]?$/.test(state.expr);
  }

  function resultString() {
    return String(state.result).replace('e', 'E');
  }

  // Start a new expression after '=': keep the result when continuing with an operator.
  function continueFrom(keepResult) {
    state.error = '';
    if (!state.done) return;
    state.expr = keepResult && state.result !== null ? resultString() : '';
    state.done = false;
  }

  function trailingNumber() {
    var m = /(\d+\.?\d*|\.\d+)(E[+-]?\d*)?$/.exec(state.expr);
    return m ? m[0] : '';
  }

  var actions = {
    digit: function (d) {
      continueFrom(false);
      var num = trailingNumber();
      if (num === '0') state.expr = state.expr.slice(0, -1);
      else if (num.replace(/\D/g, '').length >= 15) return;
      state.expr += d;
    },
    '.': function () {
      continueFrom(false);
      var num = trailingNumber();
      if (/[.E]/.test(num)) return;
      state.expr += num ? '.' : '0.';
    },
    binary: function (op) {
      continueFrom(true);
      var last = lastChar();
      if (op === '-') {
        if (last === '+' || last === '-') state.expr = state.expr.slice(0, -1);
        state.expr += '-';
        return;
      }
      if (!state.expr) state.expr = state.result === null ? '0' : resultString();
      // Replace a trailing operator (and a unary minus after it): 5×− then + gives 5+
      state.expr = state.expr.replace(/[+\-*/^]+$/, '');
      if (endsWithValue()) state.expr += op;
    },
    postfix: function (text) {
      continueFrom(true);
      if (!endsWithValue()) return;
      state.expr += text;
    },
    func: function (text) {
      continueFrom(false);
      state.expr += text;
    },
    value: function (text) {
      continueFrom(false);
      state.expr += text;
    },
    '(': function () {
      continueFrom(false);
      state.expr += '(';
    },
    ')': function () {
      continueFrom(false);
      if (openParens(state.expr) > 0 && endsWithValue()) state.expr += ')';
    },
    sign: function () {
      continueFrom(true);
      var src = state.expr;
      var num = trailingNumber();
      if (num && !/E/.test(num)) {
        var head = src.slice(0, -num.length);
        var before = head.slice(-1);
        var beforeThat = head.slice(-2, -1);
        var unaryMinus = before === '-' && (head.length === 1 || /[+\-*/^(]/.test(beforeThat));
        if (unaryMinus) state.expr = head.slice(0, -1) + num;
        else if (before === '-') state.expr = head.slice(0, -1) + '+' + num;
        else if (before === '+') state.expr = head.slice(0, -1) + '-' + num;
        else state.expr = head + '-' + num;
      } else if (!src || /[+*/^(]$/.test(src)) {
        state.expr += '-';
      } else if (/-$/.test(src)) {
        state.expr = src.slice(0, -1);
      } else if (/^-\(.*\)$/.test(src) && openParens(src.slice(2, -1)) === 0) {
        state.expr = src.slice(2, -1);
      } else {
        state.expr = '-(' + src + new Array(openParens(src) + 1).join(')') + ')';
      }
    },
    back: function () {
      if (state.error) { state.error = ''; return; }
      if (state.done) { state.done = false; state.expr = ''; return; }
      var m = new RegExp('(?:' + FUNCS.join('|') + ')\\($|Ans$|E[+-]?$').exec(state.expr);
      state.expr = state.expr.slice(0, m ? -m[0].length : -1);
    },
    AC: function () {
      state.expr = '';
      state.done = false;
      state.error = '';
    },
    '=': function () {
      if (state.done || !state.expr) return;
      try {
        var r = engine.calculate(state.expr, { angle: state.angle, ans: state.result || 0 });
        var closed = state.expr + new Array(openParens(state.expr) + 1).join(')');
        state.result = r;
        state.expr = closed;
        state.done = true;
        state.error = '';
        addHistory(closed, r);
      } catch (e) {
        state.error = e.message;
        buzz(30);
      }
    }
  };

  var KEY_ACTIONS = {
    '+': ['binary', '+'], '-': ['binary', '-'], '*': ['binary', '*'], '/': ['binary', '/'],
    pow: ['binary', '^'], '^': ['binary', '^'],
    sq: ['postfix', '^2'], fact: ['postfix', '!'], '!': ['postfix', '!'], '%': ['postfix', '%'],
    inv: ['postfix', '^(-1)'],
    sin: ['func', 'sin('], cos: ['func', 'cos('], tan: ['func', 'tan('],
    asin: ['func', 'asin('], acos: ['func', 'acos('], atan: ['func', 'atan('],
    ln: ['func', 'ln('], log: ['func', 'log('], sqrt: ['func', 'sqrt('], cbrt: ['func', 'cbrt('],
    abs: ['func', 'abs('], exp: ['func', 'e^('],
    pi: ['value', 'π'], e: ['value', 'e']
  };

  function press(a) {
    if (/^\d$/.test(a)) actions.digit(a);
    else if (KEY_ACTIONS[a]) actions[KEY_ACTIONS[a][0]](KEY_ACTIONS[a][1]);
    else if (actions[a]) actions[a]();
    else return;
    render();
  }

  // ---- History ----
  function addHistory(expr, result) {
    state.history.unshift({ expr: expr, result: result, t: Date.now() });
    if (state.history.length > 100) state.history.length = 100;
    save('history', state.history);
    renderHistory();
  }

  var COPY_ICON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';

  function renderHistory() {
    $('histClear').disabled = !state.history.length;
    if (!state.history.length) {
      histList.innerHTML = '<li class="empty">Your calculations will show up here.</li>';
      return;
    }
    histList.innerHTML = state.history.map(function (h, i) {
      return '<li style="animation-delay:' + Math.min(i, 10) * 25 + 'ms">' +
        '<button type="button" class="hist-item" data-i="' + i + '" title="Use this result">' +
        '<span class="hist-expr">' + escapeHtml(pretty(h.expr)) + ' =</span>' +
        '<span class="hist-res">' + escapeHtml(formatNumber(h.result)) + '</span></button>' +
        '<button type="button" class="icon-btn" data-copy="' + i + '" aria-label="Copy result">' + COPY_ICON + '</button>' +
        '</li>';
    }).join('');
  }

  histList.addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-copy]');
    if (copyBtn) return copy(state.history[+copyBtn.dataset.copy].result);
    var item = e.target.closest('.hist-item');
    if (!item) return;
    var h = state.history[+item.dataset.i];
    // Pick up the old result and keep calculating with it.
    state.result = h.result;
    state.expr = resultString();
    state.done = false;
    state.error = '';
    setHistory(false);
    render();
  });

  function setHistory(open) {
    app.classList.toggle('hist-on', open);
    $('history').setAttribute('aria-hidden', String(!open));
    if (open) $('histClose').focus();
  }
  $('histBtn').addEventListener('click', function () { setHistory(!app.classList.contains('hist-on')); });
  $('histClose').addEventListener('click', function () { setHistory(false); });
  $('scrim').addEventListener('click', function () { setHistory(false); });
  $('histClear').addEventListener('click', function () {
    state.history = [];
    save('history', state.history);
    renderHistory();
    toast('History cleared');
  });

  // ---- Copy & toast ----
  var toastTimer;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.remove('show'); }, 1400);
  }

  function copy(n) {
    var text = String(n);
    var done = function () { toast('Copied ' + formatNumber(n)); buzz(10); };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text) && done(); });
    } else if (fallbackCopy(text)) done();
  }
  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
    return ok;
  }

  outEl.addEventListener('click', function () {
    if (state.error) return;
    var v = state.done ? state.result : livePreview();
    if (v !== null) copy(v);
  });

  // ---- Mode, angle, theme ----
  function setMode(mode) {
    state.mode = mode;
    save('mode', mode);
    app.classList.toggle('sci-on', mode === 'sci');
    document.querySelector('.sci-wrap').inert = mode !== 'sci';
    document.querySelectorAll('[data-mode]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.mode === mode));
    });
  }
  document.querySelector('.seg').addEventListener('click', function (e) {
    var b = e.target.closest('[data-mode]');
    if (b) setMode(b.dataset.mode);
  });

  function setAngle(angle) {
    state.angle = angle;
    save('angle', angle);
    $('angle').textContent = angle.toUpperCase();
    $('angle').setAttribute('aria-label', angle === 'deg' ? 'Degrees. Switch to radians' : 'Radians. Switch to degrees');
    render();
  }
  $('angle').addEventListener('click', function () { setAngle(state.angle === 'deg' ? 'rad' : 'deg'); });

  var THEME_ICONS = {
    auto: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18Z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
    dark: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg>'
  };
  var THEME_NEXT = { auto: 'light', light: 'dark', dark: 'auto' };
  function setTheme(theme, announce) {
    state.theme = theme;
    save('theme', theme);
    if (theme === 'auto') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', theme);
    var btn = $('theme');
    btn.innerHTML = THEME_ICONS[theme];
    btn.title = 'Theme: ' + theme + ' (keyboard: T)';
    btn.setAttribute('aria-label', 'Theme: ' + theme + '. Change theme');
    var dark = theme === 'dark' || (theme === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.querySelectorAll('meta[name="theme-color"]').forEach(function (m) {
      m.setAttribute('content', dark ? '#0b0c12' : '#eef0f6');
    });
    if (announce) toast(theme === 'auto' ? 'Theme follows your device' : theme.charAt(0).toUpperCase() + theme.slice(1) + ' theme');
  }
  $('theme').addEventListener('click', function () { setTheme(THEME_NEXT[state.theme], true); });

  // ---- Input: taps, keyboard, paste ----
  function buzz(ms) {
    if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ignore */ } }
  }

  function ripple(btn, x, y) {
    var r = btn.getBoundingClientRect();
    var dot = document.createElement('span');
    dot.className = 'rip';
    dot.style.left = (x === undefined ? r.width / 2 : x - r.left) + 'px';
    dot.style.top = (y === undefined ? r.height / 2 : y - r.top) + 'px';
    btn.appendChild(dot);
    setTimeout(function () { dot.remove(); }, 500);
  }

  function onKeyClick(e) {
    var btn = e.target.closest('.key');
    if (!btn) return;
    ripple(btn, e.clientX || undefined, e.clientY || undefined);
    buzz(6);
    press(btn.dataset.a);
  }
  $('keys').addEventListener('click', onKeyClick);
  $('sci').addEventListener('click', onKeyClick);

  var KEYMAP = {
    Enter: '=', '=': '=', Escape: 'AC', Delete: 'AC', Backspace: 'back',
    x: '*', X: '*', ',': '.', p: 'pi', P: 'pi', e: 'e', E: 'e',
    s: 'sin', c: 'cos', l: 'ln', L: 'log', r: 'sqrt', '!': '!', '^': '^', F9: 'sign'
  };

  document.addEventListener('keydown', function (e) {
    if (e.altKey) return;
    var mod = e.ctrlKey || e.metaKey;
    if (mod && (e.key === 'c' || e.key === 'C')) {
      if (String(window.getSelection())) return; // let normal copy work
      var v = state.done ? state.result : livePreview();
      if (v !== null) { e.preventDefault(); copy(v); }
      return;
    }
    if (mod) return;
    if (app.classList.contains('hist-on')) {
      if (e.key === 'Escape' || e.key === 'h' || e.key === 'H') { e.preventDefault(); setHistory(false); }
      return;
    }
    if (e.key === 'h' || e.key === 'H') { e.preventDefault(); return setHistory(true); }
    if (e.key === 't' || e.key === 'T') { e.preventDefault(); return setTheme(THEME_NEXT[state.theme], true); }
    if (e.key === 'd' || e.key === 'D') { e.preventDefault(); return setAngle(state.angle === 'deg' ? 'rad' : 'deg'); }
    if (e.key === 'Enter' && /^(BUTTON|A)$/.test(document.activeElement.tagName) &&
        !document.activeElement.classList.contains('key')) return; // let focused buttons work
    var a = e.key in KEYMAP ? KEYMAP[e.key] : e.key;
    if (!a || !(/^[\d.()]$/.test(a) || KEY_ACTIONS[a] || actions[a])) return;
    e.preventDefault();
    press(a);
    var btn = document.querySelector('.key[data-a="' + CSS.escape(a === '^' ? 'pow' : a === '!' ? 'fact' : a) + '"]');
    if (btn) {
      btn.classList.add('pressed');
      setTimeout(function () { btn.classList.remove('pressed'); }, 120);
    }
  });

  // Paste an expression like "12*(3+4)" or "2×π".
  document.addEventListener('paste', function (e) {
    var text = (e.clipboardData || window.clipboardData).getData('text');
    if (!text) return;
    var clean = text.replace(/[,\s]/g, '').replace(/×/g, '*').replace(/÷/g, '/').replace(/[−–]/g, '-')
      .replace(/pi/gi, 'π');
    try { engine.tokenize(clean); } catch (err) { return toast('Can’t paste that'); }
    e.preventDefault();
    continueFrom(false);
    state.expr += clean;
    render();
  });

  // ---- Start ----
  setTheme(state.theme, false);
  setMode(state.mode === 'sci' ? 'sci' : 'basic');
  setAngle(state.angle === 'rad' ? 'rad' : 'deg');
  renderHistory();
  render();

  // Offline support when served over http(s).
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol) && !window.CALC_NO_SW) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function () { /* offline mode unavailable */ });
    });
  }
})();

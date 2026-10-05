// Unit converter screen. The keypad types into the highlighted row (simple sums
// like 12*3 work too); the other row shows the converted value.
// Conversion data lives in js/units.js, shared helpers come from js/app.js.
(function () {
  'use strict';

  var units = window.UnitConvert, engine = window.CalcEngine, ui = window.CalcUI;
  if (!units || !ui) return;
  var $ = function (id) { return document.getElementById(id); };
  var catsEl = $('cats'), noteEl = $('convNote');
  var rows = { from: $('row-from'), to: $('row-to') };
  var sels = { from: $('sel-from'), to: $('sel-to') };
  var vals = { from: $('val-from'), to: $('val-to') };
  var prevs = { from: $('prev-from'), to: $('prev-to') };

  var RATES_URL = 'https://open.er-api.com/v6/latest/USD';

  var saved = ui.load('conv', {}) || {};
  var state = {
    cat: units.category(saved.cat) ? saved.cat : 'length',
    picks: saved.picks && typeof saved.picks === 'object' ? saved.picks : {}, // catId -> [from, to]
    side: saved.side === 'to' ? 'to' : 'from', // the row being typed into
    text: typeof saved.text === 'string' && saved.text ? saved.text : '1',
    fresh: true, // the next digit replaces the text
    updating: false
  };

  // Saved live currency rates, if any.
  var savedRates = ui.load('rates', null);
  if (savedRates && savedRates.values) {
    units.setRates(savedRates.values, 'Rates from ' + savedRates.date, true);
  }

  function persist() {
    ui.save('conv', { cat: state.cat, picks: state.picks, side: state.side, text: state.text });
  }

  function cat() { return units.category(state.cat); }

  function picks() {
    var c = cat(), p = state.picks[c.id];
    if (!p || !units.unit(c, p[0]) || !units.unit(c, p[1])) p = state.picks[c.id] = [c.from, c.to];
    return { from: p[0], to: p[1] };
  }

  function other(side) { return side === 'from' ? 'to' : 'from'; }

  // ---- Values ----
  // The typed text as a number, ignoring a trailing operator, or null.
  function typedValue() {
    var src = state.text.replace(/[+\-*/^(]+$/, '');
    if (!src || src === '-') return null;
    src += new Array(ui.openParens(src) + 1).join(')');
    try { return engine.calculate(src, { angle: 'deg', ans: 0 }); } catch (e) { return null; }
  }

  function convertedValue() {
    var v = typedValue();
    if (v === null) return null;
    var p = picks();
    var from = state.side === 'from' ? p.from : p.to;
    var to = state.side === 'from' ? p.to : p.from;
    var r = units.convert(state.cat, v, from, to);
    return isNaN(r) ? null : r;
  }

  // Money reads best with two decimals (four significant digits for tiny
  // amounts); everything else shows ten significant digits.
  function show(n) {
    if (n === null || isNaN(n)) return '—';
    if (state.cat !== 'currency') n = parseFloat(n.toPrecision(10));
    else if (Math.abs(n) >= 0.01 && Math.abs(n) < 1e12) n = Math.round(n * 100) / 100;
    else n = parseFloat(n.toPrecision(4));
    return ui.formatNumber(n);
  }

  function isPlainNumber(text) { return /^-?(\d+\.?\d*|\.\d+)(E[+-]?\d+)?$/.test(text); }

  // ---- Rendering ----
  function renderCats() {
    catsEl.innerHTML = units.categories.map(function (c) {
      return '<button type="button" class="cat" role="tab" data-cat="' + c.id + '" aria-selected="' +
        (c.id === state.cat) + '">' + ui.escapeHtml(c.name) + '</button>';
    }).join('');
  }

  function renderSelects() {
    var c = cat(), p = picks();
    var options = c.units.map(function (unit) {
      var label = c.id === 'currency' ? unit.symbol + ' · ' + unit.name : unit.name + ' (' + unit.symbol + ')';
      return '<option value="' + ui.escapeHtml(unit.id) + '">' + ui.escapeHtml(label) + '</option>';
    }).join('');
    sels.from.innerHTML = options;
    sels.to.innerHTML = options;
    sels.from.value = p.from;
    sels.to.value = p.to;
  }

  function fit(el, text) {
    var n = text.length;
    el.style.setProperty('--cv-size', n > 20 ? '1.25rem' : n > 14 ? '1.55rem' : '');
  }

  function render() {
    var active = state.side, passive = other(active);
    rows[active].classList.add('active');
    rows[passive].classList.remove('active');

    var typed = state.text ? ui.pretty(state.text) : '0';
    vals[active].innerHTML = ui.escapeHtml(typed) + '<span class="caret"></span>';
    fit(vals[active], typed);
    var v = typedValue();
    prevs[active].textContent = isPlainNumber(state.text) || v === null ? '' : '= ' + show(v);

    var out = show(convertedValue());
    vals[passive].textContent = out;
    fit(vals[passive], out);
    prevs[passive].textContent = '';

    renderNote();
    persist();
  }

  function renderNote() {
    var c = cat(), p = picks();
    var a = units.unit(c, p.from), b = units.unit(c, p.to);
    var one = units.convert(c.id, 1, p.from, p.to);
    var html = ui.escapeHtml('1 ' + a.symbol + ' = ' + show(one) + ' ' + b.symbol);
    if (c.id === 'currency') {
      var r = units.getRates();
      html += '<br>' + ui.escapeHtml(r.label) + (r.live ? '' : ', may be out of date') +
        ' <button type="button" class="text-btn" id="ratesBtn"' + (state.updating ? ' disabled' : '') + '>' +
        (state.updating ? 'Updating…' : 'Update rates') + '</button>';
    }
    noteEl.innerHTML = html;
  }

  // ---- Typing ----
  function trailingNumber() {
    var m = /(\d+\.?\d*|\.\d+)(E[+-]?\d*)?$/.exec(state.text);
    return m ? m[0] : '';
  }
  function endsWithValue() { return /[\d.)%]$/.test(state.text); }

  function startFresh() {
    if (state.fresh) { state.text = ''; state.fresh = false; }
  }

  var actions = {
    digit: function (d) {
      startFresh();
      var num = trailingNumber();
      if (num === '0') state.text = state.text.slice(0, -1);
      else if (num.replace(/\D/g, '').length >= 15) return;
      state.text += d;
    },
    '.': function () {
      startFresh();
      var num = trailingNumber();
      if (/[.E]/.test(num)) return;
      state.text += num ? '.' : '0.';
    },
    op: function (op) {
      state.fresh = false;
      if (op === '-' && (!state.text || /[*/(]$/.test(state.text))) { state.text += '-'; return; }
      state.text = state.text.replace(/[+\-*/]+$/, '');
      if (endsWithValue()) state.text += op;
    },
    '%': function () {
      state.fresh = false;
      if (endsWithValue()) state.text += '%';
    },
    '(': function () { startFresh(); state.text += '('; },
    ')': function () {
      state.fresh = false;
      if (ui.openParens(state.text) > 0 && endsWithValue()) state.text += ')';
    },
    sign: function () {
      state.fresh = false;
      var t = state.text;
      if (!t || t === '0') state.text = '-';
      else if (t === '-') state.text = '';
      else if (isPlainNumber(t)) state.text = t.charAt(0) === '-' ? t.slice(1) : '-' + t;
      else if (/^-\(.*\)$/.test(t) && ui.openParens(t.slice(2, -1)) === 0) state.text = t.slice(2, -1);
      else state.text = '-(' + t + new Array(ui.openParens(t) + 1).join(')') + ')';
    },
    back: function () {
      state.fresh = false;
      var m = /E[+-]?$/.exec(state.text);
      state.text = state.text.slice(0, m ? -m[0].length : -1);
    },
    AC: function () { state.text = '0'; state.fresh = true; },
    '=': function () {
      var v = typedValue();
      if (v === null) { ui.buzz(30); return; }
      state.text = String(v).replace('e', 'E');
      state.fresh = true;
    }
  };

  var KEYS = { '+': ['op', '+'], '-': ['op', '-'], '*': ['op', '*'], '/': ['op', '/'] };

  function press(a) {
    if (/^\d$/.test(a)) actions.digit(a);
    else if (KEYS[a]) actions[KEYS[a][0]](KEYS[a][1]);
    else if (actions[a]) actions[a]();
    else return;
    render();
  }

  function paste(clean) {
    if (!/^[\d.+\-*/()%E]+$/.test(clean)) { ui.toast('Can’t paste that'); return; }
    startFresh();
    state.text += clean;
    render();
  }

  // ---- Switching rows, units and categories ----
  function activate(side) {
    if (side === state.side) return;
    var v = convertedValue();
    state.side = side;
    state.text = v === null ? '0' : String(parseFloat(v.toPrecision(10))).replace('e', 'E');
    state.fresh = true;
    render();
  }

  Object.keys(rows).forEach(function (side) {
    rows[side].addEventListener('click', function (e) {
      if (e.target.closest('select, button')) return;
      activate(side);
    });
    sels[side].addEventListener('change', function () {
      var p = state.picks[state.cat] || (state.picks[state.cat] = [cat().from, cat().to]);
      p[side === 'from' ? 0 : 1] = sels[side].value;
      render();
    });
  });

  $('conv').addEventListener('click', function (e) {
    var copyBtn = e.target.closest('[data-copy-side]');
    if (!copyBtn) return;
    var v = copyBtn.dataset.copySide === state.side ? typedValue() : convertedValue();
    if (v !== null) ui.copy(v);
  });

  $('swap').addEventListener('click', function () {
    var p = picks();
    state.picks[state.cat] = [p.to, p.from];
    sels.from.value = p.to;
    sels.to.value = p.from;
    var btn = $('swap');
    btn.classList.toggle('spin');
    ui.buzz(6);
    render();
  });

  catsEl.addEventListener('click', function (e) {
    var b = e.target.closest('[data-cat]');
    if (!b || b.dataset.cat === state.cat) return;
    state.cat = b.dataset.cat;
    state.side = 'from';
    state.text = '1';
    state.fresh = true;
    catsEl.querySelectorAll('[data-cat]').forEach(function (x) {
      x.setAttribute('aria-selected', String(x === b));
    });
    scrollCatIntoView(b);
    renderSelects();
    render();
  });

  function scrollCatIntoView(b) {
    var left = b.offsetLeft - (catsEl.clientWidth - b.offsetWidth) / 2;
    try { catsEl.scrollTo({ left: left, behavior: 'smooth' }); } catch (e) { catsEl.scrollLeft = left; }
  }

  // ---- Live currency rates ----
  noteEl.addEventListener('click', function (e) {
    if (e.target.id === 'ratesBtn') updateRates();
  });

  function updateRates() {
    if (state.updating) return;
    if (typeof fetch !== 'function') return ui.toast('Can’t update rates here');
    state.updating = true;
    renderNote();
    fetch(RATES_URL, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return res.json();
    }).then(function (data) {
      if (data.result !== 'success' || !data.rates) throw new Error('Bad data');
      var when = new Date((data.time_last_update_unix || Date.now() / 1000) * 1000);
      var date = when.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
      units.setRates(data.rates, 'Rates from ' + date, true);
      ui.save('rates', { values: units.getRates().values, date: date });
      ui.toast('Rates updated');
    }).catch(function () {
      ui.toast('Couldn’t update rates, are you online?');
    }).then(function () {
      state.updating = false;
      if (state.cat === 'currency') { renderSelects(); render(); }
    });
  }

  window.ConvUI = { press: press, paste: paste };

  renderCats();
  renderSelects();
  render();
  var current = catsEl.querySelector('[aria-selected="true"]');
  if (current) catsEl.scrollLeft = Math.max(0, current.offsetLeft - 16);
})();

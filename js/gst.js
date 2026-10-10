// GST calculator: add GST to a price or take it out of a GST-inclusive price,
// with the CGST + SGST (or IGST) split. The maths at the top works in Node;
// the screen below it runs in the browser and uses helpers from js/app.js.
(function (root) {
  'use strict';

  // GST slabs: 5%, 18% and 40% since 22 Sep 2025; 3% for gold and silver;
  // 12% and 28% for bills from before the change.
  var RATES = [3, 5, 12, 18, 28, 40];
  var DEFAULT_RATE = 18;

  function round2(n) { return Math.round((n + (n < 0 ? -1 : 1) * 1e-9) * 100) / 100; }

  // calc(1000, 18, 'add')    -> { base: 1000, gst: 180, cgst: 90, sgst: 90, total: 1180 }
  // calc(1180, 18, 'remove') -> { base: 1000, gst: 180, cgst: 90, sgst: 90, total: 1180 }
  // Amounts are rounded to paise; CGST and SGST always add up to the GST.
  function calc(amount, rate, mode) {
    if (!isFinite(amount) || !isFinite(rate) || rate < 0) throw new Error('Invalid input');
    var base, gst, total;
    if (mode === 'remove') {
      total = round2(amount);
      base = round2(amount * 100 / (100 + rate));
      gst = round2(total - base);
    } else {
      base = round2(amount);
      gst = round2(amount * rate / 100);
      total = round2(base + gst);
    }
    var cgst = round2(gst / 2);
    return { base: base, gst: gst, cgst: cgst, sgst: round2(gst - cgst), total: total };
  }

  var api = { calc: calc, round2: round2, RATES: RATES, DEFAULT_RATE: DEFAULT_RATE };
  if (typeof module !== 'undefined' && module.exports) { module.exports = api; return; }
  root.GstMath = api;

  // ---- Screen ----
  var ui = root.CalcUI, doc = root.document;
  if (!ui || !root.ExprEditor || !doc.getElementById('gst')) return;
  var $ = function (id) { return doc.getElementById(id); };

  var saved = ui.load('gst', {}) || {};
  var state = {
    mode: saved.mode === 'remove' ? 'remove' : 'add',
    split: saved.split === 'igst' ? 'igst' : 'cs', // CGST + SGST, or IGST for inter-state
    rate: typeof saved.rate === 'number' && saved.rate >= 0 && saved.rate <= 100 ? saved.rate : DEFAULT_RATE,
    custom: RATES.indexOf(saved.rate) === -1 && typeof saved.rate === 'number'
  };
  var ed = root.ExprEditor(saved.text || '1000', function () { ui.buzz(30); });

  var money = (function () {
    try {
      var f = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      return function (n) { return (n < 0 ? '−₹' : '₹') + f.format(Math.abs(n)); };
    } catch (e) {
      return function (n) { return (n < 0 ? '−₹' : '₹') + Math.abs(n).toFixed(2); };
    }
  })();
  // What the user typed, with Indian digit grouping (1,00,000) to match the amounts below.
  function prettyIndian(text) {
    return text.replace(/(\d+)(\.\d*)?/g, function (m, int, frac) {
      var last3 = int.slice(-3), rest = int.slice(0, -3);
      return (rest ? rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + ',' : '') + last3 + (frac || '');
    }).replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
  }
  function pct(r) { return String(parseFloat(r.toFixed(4))) + '%'; }

  function persist() {
    ui.save('gst', { mode: state.mode, split: state.split, rate: state.rate, text: ed.text });
  }

  function result() {
    var v = ed.value();
    if (v === null) return null;
    try { return calc(v, state.rate, state.mode); } catch (e) { return null; }
  }

  function renderRates() {
    $('gstRates').innerHTML = RATES.map(function (r) {
      return '<button type="button" class="cat" role="radio" data-rate="' + r + '" aria-checked="' +
        (!state.custom && r === state.rate) + '">' + r + '%</button>';
    }).join('') +
      '<button type="button" class="cat" role="radio" data-rate="custom" aria-checked="' + state.custom + '">Other</button>';
    var input = $('gstCustom');
    input.hidden = !state.custom;
    if (state.custom && doc.activeElement !== input) input.value = state.rate;
  }

  function render() {
    doc.querySelectorAll('[data-gmode]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.gmode === state.mode));
    });
    doc.querySelectorAll('[data-split]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.dataset.split === state.split));
    });
    $('gstAmtLabel').textContent = state.mode === 'add' ? 'Amount before GST' : 'Amount including GST';

    var typed = ed.text ? prettyIndian(ed.text) : '0';
    $('gstAmt').innerHTML = '₹' + ui.escapeHtml(typed) + '<span class="caret"></span>';
    $('gstAmt').style.setProperty('--cv-size', typed.length > 18 ? '1.3rem' : typed.length > 12 ? '1.6rem' : '');
    var v = ed.value();
    $('gstPrev').textContent = ed.isPlainNumber() || v === null ? '' : '= ' + money(v);

    var r = result();
    var half = pct(state.rate / 2);
    var rows = [
      ['Net amount', r && r.base, 'base'],
      ['GST ' + pct(state.rate), r && r.gst, 'gst']
    ];
    var split = state.split === 'igst'
      ? [['IGST ' + pct(state.rate), r && r.gst]]
      : [['CGST ' + half, r && r.cgst], ['SGST ' + half, r && r.sgst]];
    var html = rows.map(function (row) {
      return '<button type="button" class="gst-line" data-copy-val="' + (row[1] === null ? '' : row[1]) + '">' +
        '<span>' + ui.escapeHtml(row[0]) + '</span><span>' + (row[1] === null ? '—' : money(row[1])) + '</span></button>';
    }).join('');
    html += '<div class="gst-split">' + split.map(function (row) {
      return '<span>' + ui.escapeHtml(row[0]) + ' ' + (row[1] === null ? '—' : money(row[1])) + '</span>';
    }).join('<span aria-hidden="true">·</span>') + '</div>';
    html += '<button type="button" class="gst-line gst-total" data-copy-val="' + (r ? r.total : '') + '">' +
      '<span>Total</span><span>' + (r ? money(r.total) : '—') + '</span></button>';
    $('gstOut').innerHTML = html;
    persist();
  }

  function press(a) {
    if (ed.press(a)) render();
  }
  function paste(clean) {
    if (!ed.paste(clean)) { ui.toast('Can’t paste that'); return; }
    render();
  }

  $('gst').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.gmode && b.dataset.gmode !== state.mode) {
      // Keep the figure the user cares about: switching to "remove" starts from
      // the total, switching to "add" from the net amount.
      var r = result();
      state.mode = b.dataset.gmode;
      if (r) ed.set(state.mode === 'remove' ? r.total : r.base);
      render();
    } else if (b.dataset.split) {
      state.split = b.dataset.split;
      render();
    } else if (b.dataset.rate) {
      if (b.dataset.rate === 'custom') {
        state.custom = true;
        renderRates();
        $('gstCustom').focus();
        $('gstCustom').select();
      } else {
        state.custom = false;
        state.rate = +b.dataset.rate;
        renderRates();
      }
      render();
    } else if (b.dataset.copyVal) {
      ui.copy(+b.dataset.copyVal);
    }
  });

  $('gstCustom').addEventListener('input', function () {
    var r = parseFloat(this.value);
    if (isFinite(r) && r >= 0 && r <= 100) { state.rate = r; render(); }
  });
  $('gstCustom').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') this.blur();
  });

  root.GstUI = { press: press, paste: paste };

  renderRates();
  render();
})(this);

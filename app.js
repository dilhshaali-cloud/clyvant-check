(function () {
  'use strict';
  var SITE = 'check.clyvant.ai';
  var FORM_URL = 'https://submit.jotform.com/submit/263176319018054';

  var MARKETS = {
    US: { name: 'United States', form: 'United States', cur: 'USD', locale: 'en-US', dec: 2, fee: 6, perOrder: 0, vat: 0, smart: true, vatLabel: 'Sales tax in your prices %', feeNote: 'Referral fee. TikTok’s table says 6%; some sellers see 8% since 4 Aug 2026.' },
    UK: { name: 'United Kingdom', form: 'United Kingdom', cur: 'GBP', locale: 'en-GB', dec: 2, fee: 9, perOrder: 0, vat: 20, vatLabel: 'VAT in your prices %', feeNote: 'Commission, most categories, since 2 Sep 2024.' },
    EU: { name: 'Europe', form: 'Europe', cur: 'EUR', locale: 'en-IE', dec: 2, fee: 9, perOrder: 0, vat: 20, vatLabel: 'VAT in your prices %', feeNote: 'Commission, most categories, since 8 Jan 2026.', countries: { FR: 20, DE: 19, IT: 22, ES: 21, IE: 23 } },
    MY: { name: 'Malaysia', form: 'Malaysia', cur: 'MYR', locale: 'en-MY', dec: 2, fee: 13.8, perOrder: 0.54, vat: 0, vatLabel: 'Tax in your prices %', feeNote: 'Commission by category plus the 3.78% transaction fee. RM0.54 per order.' },
    ID: { name: 'Indonesia', form: 'Indonesia', cur: 'IDR', locale: 'id-ID', dec: 0, fee: 16, perOrder: 1250, vat: 0, vatLabel: 'PPN in your prices %', feeNote: 'Platform plus dynamic commission. Rp1,250 per order.' }
  };
  var EXAMPLE = { market: 'EU', country: 'FR', mode: 'payouts', cost: '10,178.21', gross: '29,108.15', costAff: '3,664.28', gmv: '30,322.97', orders: '1,838', items: '2,262', creators: '24,120.47', payout: '15,585.41', unitCost: '2.23', vat: '5.5' };
  var FIELDS = ['cost', 'gross', 'costAff', 'gmv', 'orders', 'items', 'creators', 'payout', 'unitCost', 'vat', 'fee', 'commission', 'ship', 'refunds', 'perOrder'];
  var state = { market: 'EU', mode: 'payouts', example: false };
  var $ = function (id) { return document.getElementById(id); };

  /* ---------- numbers ---------- */
  function parseNum(raw, integer) {
    if (raw === null || raw === undefined) return NaN;
    var s = String(raw).trim();
    if (!s) return NaN;
    var neg = /^[\-−(]/.test(s);
    s = s.replace(/[^\d.,]/g, '');
    if (!s) return NaN;
    var dec0 = MARKETS[state.market].dec === 0;
    var ld = s.lastIndexOf('.'), lc = s.lastIndexOf(',');
    if (ld > -1 && lc > -1) {
      var d = ld > lc ? '.' : ',';
      s = s.split(d === '.' ? ',' : '.').join('');
      if (d === ',') s = s.replace(',', '.');
    } else if (lc > -1) {
      var pc = s.split(',');
      if (pc.length > 2 || (pc[1].length === 3 && (integer || dec0 || pc[0] !== '0'))) s = pc.join('');
      else s = pc.join('.');
    } else if (ld > -1) {
      var pd = s.split('.');
      if (pd.length > 2 || (pd[1].length === 3 && (integer || dec0))) s = pd.join('');
    }
    var n = parseFloat(s);
    if (isNaN(n)) return NaN;
    return neg ? -n : n;
  }
  function val(id, integer) { return parseNum($(id).value, integer); }
  function fmtMoney(n, dec) {
    var M = MARKETS[state.market];
    var d = dec !== undefined ? dec : (Math.abs(n) >= 1000 ? 0 : M.dec);
    if (M.dec === 0) d = 0;
    try { return new Intl.NumberFormat(M.locale, { style: 'currency', currency: M.cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
    catch (e) { return M.cur + ' ' + n.toFixed(d); }
  }
  function unit() { return MARKETS[state.market].dec === 0 ? fmtMoney(1000, 0) : fmtMoney(1, 0); }
  function perUnit(x) { return MARKETS[state.market].dec === 0 ? fmtMoney(x * 1000, 0) : fmtMoney(x, 2); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function r2(x) { return x.toFixed(2); }

  /* ---------- reading pasted Seller Centre pages ---------- */
  var CURRENCY = /(EUR|USD|GBP|MYR|IDR|RM|Rp|€|\$|£)/g;
  function linesOf(text) {
    return String(text || '').replace(/\r/g, '').split('\n')
      .map(function (s) { return s.replace(/[   ]/g, ' ').trim(); })
      .filter(function (s) { return s.length > 0; });
  }
  function isValue(s) { return /^[\-−]?[\d][\d.,\s]*%?$/.test(s.replace(CURRENCY, '').replace(/\s+/g, ' ').trim()); }
  function after(L, label) {
    var want = label.toLowerCase();
    for (var i = 0; i < L.length - 1; i++) {
      if (L[i].toLowerCase() !== want) continue;
      for (var j = i + 1; j <= i + 3 && j < L.length; j++) { if (isValue(L[j])) return L[j]; }
    }
    return null;
  }
  function detectMarket(text) {
    if (/\bRp\s?\d|\bIDR\b/.test(text)) return 'ID';
    if (/\bRM\s?\d|\bMYR\b/.test(text)) return 'MY';
    if (/£|\bGBP\b/.test(text)) return 'UK';
    if (/€|\bEUR\b/.test(text)) return 'EU';
    if (/\$|\bUSD\b/.test(text)) return 'US';
    return null;
  }
  function readAds(text) {
    var L = linesOf(text);
    return { cost: after(L, 'Cost'), gross: after(L, 'Gross revenue'), costAff: after(L, 'Cost (affiliate)') };
  }
  function readAnalytics(text) {
    var L = linesOf(text), sum = 0, found = 0;
    for (var i = 0; i < L.length - 2; i++) {
      if (L[i] === 'Affiliate' && /^\(Contribution/.test(L[i + 1]) && isValue(L[i + 2])) { sum += parseNum(L[i + 2]) || 0; found++; }
    }
    return { gmv: after(L, 'GMV'), orders: after(L, 'Orders'), items: after(L, 'Items sold'), creators: found ? String(Math.round(sum * 100) / 100) : null };
  }
  function readPayouts(text) {
    var L = linesOf(text);
    return { payout: after(L, 'Payout amount') };
  }
  var READERS = {
    ads: { read: readAds, fields: { cost: 'Cost', gross: 'Gross revenue', costAff: 'Cost (affiliate)' }, need: ['cost', 'gross'] },
    analytics: { read: readAnalytics, fields: { gmv: 'GMV', orders: 'Orders', items: 'Items sold', creators: 'Sales through creators' }, need: ['gmv', 'orders', 'items'] },
    payouts: { read: readPayouts, fields: { payout: 'Payout amount' }, need: ['payout'] }
  };
  function onPaste(kind) {
    var box = $('paste-' + kind), status = $('status-' + kind), R = READERS[kind];
    var text = box.value;
    if (!text.trim()) { status.textContent = ''; status.removeAttribute('data-state'); return; }
    var m = detectMarket(text);
    var switched = false;
    if (m && m !== state.market) { applyMarket(m, false); switched = true; }
    var got = R.read(text), read = [], missing = [];
    Object.keys(R.fields).forEach(function (k) {
      var input = $(k);
      if (got[k] !== null && got[k] !== undefined) {
        var n = parseNum(got[k], k === 'orders' || k === 'items');
        if (isFinite(n)) { input.value = String(n); input.classList.add('is-filled'); read.push(R.fields[k]); return; }
      }
      if (R.need.indexOf(k) > -1) missing.push(R.fields[k]);
    });
    leaveExample();
    if (!read.length) {
      status.setAttribute('data-state', 'bad');
      status.textContent = 'No numbers found. Check the page is in English and copy it with Ctrl+A, then Ctrl+C, or type them below.';
    } else {
      status.setAttribute('data-state', missing.length ? 'bad' : 'ok');
      if (!missing.length) box.value = '';
      status.textContent = 'Read ' + read.join(', ') + '.' + (missing.length ? ' Type ' + missing.join(', ') + ' below.' : ' Paste again to update.') + (switched ? ' Market set to ' + MARKETS[state.market].name + '.' : '');
    }
    render();
  }

  /* ---------- market and mode ---------- */
  function applyMarket(m, resetVat) {
    state.market = m;
    var M = MARKETS[m];
    $('market').value = m;
    $('countryWrap').hidden = !M.countries;
    $('vatLabel').textContent = M.vatLabel;
    if (resetVat !== false) $('vat').value = String(M.countries ? M.countries[$('country').value] : M.vat);
    $('fee').value = String(M.fee);
    $('feeNote').textContent = M.feeNote;
    $('perOrderWrap').hidden = !M.perOrder;
    $('perOrder').value = String(M.perOrder || 0);
    $('smartWrap').hidden = !M.smart;
    if (!M.smart) $('smart').checked = false;
    $('eaMarket').value = M.form;
    document.querySelectorAll('[data-cur]').forEach(function (el) { el.textContent = M.cur; });
    render();
  }
  function applyMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
    $('mode-payouts').hidden = mode !== 'payouts';
    $('mode-estimate').hidden = mode !== 'estimate';
    render();
  }

  /* ---------- the math ---------- */
  function compute() {
    var C = val('cost'), G = val('gross'), T = val('gmv'), N = val('orders', true), U = val('items', true), p = val('unitCost');
    var A = val('creators'), CA = val('costAff');
    var v = (val('vat') || 0) / 100;
    var missing = [];
    if (!(C > 0)) missing.push('Cost');
    if (!(G >= 0) || isNaN(G)) missing.push('Gross revenue');
    if (!(T > 0)) missing.push('GMV');
    if (!(N > 0)) missing.push('Orders');
    if (!(U > 0)) missing.push('Items sold');
    if (!(p >= 0) || isNaN(p)) missing.push('product cost per item');
    var kept, parts;
    if (state.mode === 'payouts') {
      var P = val('payout');
      if (isNaN(P)) missing.push('payout amount');
      if (missing.length) return { missing: missing };
      var vatP = T * v / (1 + v), prodP = U * p;
      kept = P - vatP - prodP;
      parts = { cut: T - P, vat: vatP, product: prodP };
    } else {
      var ship = val('ship');
      if (isNaN(ship)) missing.push('shipping per order');
      if (missing.length) return { missing: missing };
      var r = (val('refunds') || 0) / 100;
      var sales = T * (1 - r);
      var vatQ = sales * v / (1 + v);
      var fees = sales * (val('fee') || 0) / 100 + ($('smart').checked ? sales * 0.035 : 0) + N * (1 - r) * (val('perOrder') || 0);
      var creator = (isFinite(A) ? A : 0) * (1 - r) * (val('commission') || 0) / 100;
      var shipping = N * ship, prodQ = U * p;
      kept = sales - vatQ - fees - creator - shipping - prodQ;
      parts = { cut: (T - sales) + fees + creator + shipping, vat: vatQ, product: prodQ };
    }
    var m = kept / T, back = m * G;
    var res = {
      C: C, G: G, T: T, A: A, CA: CA, m: m, back: back, parts: parts,
      credit: G / T, tiktokROI: G / C, realROI: Math.max(0, back / C), net: back - C, be: m > 0 ? 1 / m : Infinity,
      creators: isFinite(A) && A >= 0 ? A / T : null, adsOnCreators: isFinite(CA) && CA >= 0 ? CA / C : null, adsPerSale: C / T
    };
    res.keptPer1 = res.net / C;
    res.verdict = res.keptPer1 >= 0.3 ? 'Scale' : (res.keptPer1 >= 0 ? 'Keep' : 'Cut');
    return res;
  }

  /* ---------- drawing ---------- */
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function axisSVG(tt, real, be, W, cls) {
    W = W || 600;
    var top = Math.max(4, Math.ceil(Math.max(tt, real, isFinite(be) ? be : 0) + 0.25));
    var x0 = 12, x1 = W - 12, w = x1 - x0, y = 74;
    var X = function (v) { return x0 + Math.min(v, top) / top * w; };
    var s = '<svg class="axis' + (cls ? ' ' + cls : '') + '" viewBox="0 0 ' + W + ' 108" role="img" aria-label="ROI scale: real ' + r2(real) + ', TikTok ' + r2(tt) + (isFinite(be) ? ', break-even ' + r2(be) : ', no break-even') + '">';
    if (isFinite(be) && be < top) s += '<rect class="ax-band" x="' + X(be).toFixed(1) + '" y="64" width="' + (x1 - X(be)).toFixed(1) + '" height="10"/>';
    s += '<line class="ax-line" x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="' + y + '"/>';
    for (var k = 0; k <= top; k++) {
      var tx = X(k), anchor = k === 0 ? 'start' : (k === top ? 'end' : 'middle');
      s += '<line class="ax-tick" x1="' + tx.toFixed(1) + '" y1="' + y + '" x2="' + tx.toFixed(1) + '" y2="' + (y + 6) + '"/>';
      s += '<text class="ax-label" x="' + tx.toFixed(1) + '" y="100" text-anchor="' + anchor + '">' + k + '</text>';
    }
    if (isFinite(be) && be <= top) {
      var bx = X(be);
      s += '<line class="ax-be" x1="' + bx.toFixed(1) + '" y1="16" x2="' + bx.toFixed(1) + '" y2="' + (y + 6) + '"/>';
      var banchor = bx > x1 - 70 ? 'end' : (bx < x0 + 70 ? 'start' : 'middle');
      s += '<text class="ax-be-label" x="' + bx.toFixed(1) + '" y="11" text-anchor="' + banchor + '">break-even ' + r2(be) + '</text>';
    }
    var bxs = isFinite(be) && be <= top ? X(be) : null;
    [[real, 'orange', 'real'], [tt, 'blue', 'TikTok']].forEach(function (p) {
      var px = X(p[0]), a = px > x1 - 50 ? 'end' : (px < x0 + 50 ? 'start' : 'middle'), lx = px;
      if (bxs !== null && Math.abs(px - bxs) < 60) { if (px <= bxs) { a = 'end'; lx = px + 5; } else { a = 'start'; lx = px - 5; } }
      s += '<line class="pin pin--' + p[1] + '" x1="' + px.toFixed(1) + '" y1="44" x2="' + px.toFixed(1) + '" y2="' + y + '"/>';
      s += '<rect class="pin pin--' + p[1] + '" x="' + (px - 5).toFixed(1) + '" y="56" width="10" height="10"/>';
      s += '<text class="pin-label" x="' + lx.toFixed(1) + '" y="37" text-anchor="' + a + '">' + p[2] + ' ' + r2(p[0]) + '</text>';
    });
    return s + '</svg>';
  }
  window.__axisSVG = axisSVG;

  function render() {
    var r = compute(), box = $('result');
    if (r.missing) {
      box.innerHTML = '<div class="result__empty"><p class="inst__cap">Your shop</p><p>Still needed: ' + esc(r.missing.join(', ')) + '.</p><p><button type="button" class="textbtn" data-example>Show our numbers first</button></p></div>';
      save();
      return;
    }
    var made = r.net >= 0, M = MARKETS[state.market];
    var cap = state.example ? 'Our shop in France, 14 May to 14 Nov 2026' : 'Your shop, ' + M.name;
    var vword = { Cut: 'Ads lose money. ', Keep: 'Ads pay for themselves, barely. ', Scale: 'Ads make money. ' }[r.verdict];
    var vline;
    if (r.verdict === 'Cut') vline = isFinite(r.be) ? 'You break even at ROI ' + r2(r.be) + ' and TikTok shows ' + r2(r.tiktokROI) + '. Raise your ROI target to at least ' + r2(r.be) + ', or cut the budget.' : 'Each sale loses money before ads, so no ROI target fixes this. Fix price or costs first.';
    else if (r.verdict === 'Keep') vline = 'Each ' + unit() + ' of ads keeps ' + perUnit(r.keptPer1) + '. Hold the budget until it keeps ' + perUnit(0.3) + '.';
    else vline = 'Each ' + unit() + ' of ads keeps ' + perUnit(r.keptPer1) + ' after every cost. There is room to spend more.';
    var facts = '<dt>Sales counted as GMV Max sales</dt><dd class="measure">' + pct(r.credit) + '</dd>';
    if (r.creators !== null) facts += '<dt>Sales through creators’ videos</dt><dd class="measure">' + pct(r.creators) + '</dd>';
    if (r.adsOnCreators !== null) facts += '<dt>Ad cost on creators’ videos, paid twice at most</dt><dd class="measure">' + pct(r.adsOnCreators) + '</dd>';
    facts += '<dt>Ads per ' + esc(unit()) + ' of sales</dt><dd class="measure">' + esc(perUnit(r.adsPerSale)) + '</dd>';
    box.innerHTML =
      '<p class="inst__cap">' + esc(cap) + '</p>' +
      '<div class="inst__pair"><div><span class="lbl"><i class="sw sw--blue" aria-hidden="true"></i>TikTok ROI</span><span class="measure big">' + r2(r.tiktokROI) + '</span></div>' +
      '<div><span class="lbl"><i class="sw sw--orange" aria-hidden="true"></i>Real ROI</span><span class="measure big">' + r2(r.realROI) + '</span></div></div>' +
      axisSVG(r.tiktokROI, r.realROI, r.be, Math.max(300, Math.min(600, Math.round((box.clientWidth || 600) - 2 * parseFloat(getComputedStyle(box).paddingLeft || '0'))))) +
      '<dl class="inst__row"><div><dt>Ads</dt><dd class="measure">' + esc(fmtMoney(r.C)) + '</dd></div><div><dt>Brought back</dt><dd class="measure">' + esc(fmtMoney(Math.max(0, r.back))) + '</dd></div><div><dt>' + (made ? 'Made' : 'Lost') + '</dt><dd class="measure">' + esc(fmtMoney(Math.abs(r.net))) + '</dd></div></dl>' +
      '<div class="verdict"><span class="verdict__word"><i class="sw ' + (r.verdict === 'Cut' ? 'sw--orange' : 'sw--blue') + '" aria-hidden="true"></i>' + r.verdict + '</span><p>' + esc(vword + vline) + '</p></div>' +
      '<dl class="facts">' + facts + '</dl>' +
      '<div class="result__actions"><button type="button" class="btn" data-copy>Copy my result</button><a class="btn" data-copy data-send href="https://www.linkedin.com/in/dilshad-ali-ceo/" rel="noopener" target="_blank">Send it to Dilshad</a></div>' +
      '<p class="result__note" aria-live="polite" id="copyNote"></p>';
    $('jfResult').value = $('eaBench').checked ? benchLine(r) : '';
    save();
  }
  function resultLine(r) {
    return 'GMV Max Credit Check (' + MARKETS[state.market].name + '): GMV Max was credited with ' + pct(r.credit) + ' of my shop’s sales. TikTok shows ROI ' + r2(r.tiktokROI) + '. After every cost the real ROI is ' + r2(r.realROI) + '. Break-even ROI: ' + (isFinite(r.be) ? r2(r.be) : 'none') + '. Check yours: ' + SITE;
  }
  function benchLine(r) {
    return [state.market, state.mode, 'credit=' + r.credit.toFixed(3), 'roi=' + r.tiktokROI.toFixed(2), 'real=' + r.realROI.toFixed(2), 'be=' + (isFinite(r.be) ? r.be.toFixed(2) : 'inf'), 'creators=' + (r.creators !== null ? r.creators.toFixed(3) : 'na'), 'adsOnCreators=' + (r.adsOnCreators !== null ? r.adsOnCreators.toFixed(3) : 'na'), 'adsPerSale=' + r.adsPerSale.toFixed(3), state.example ? 'example' : 'user'].join('; ');
  }

  /* ---------- memory, example, links ---------- */
  function save() {
    if (state.example) return;
    try {
      var o = { market: state.market, mode: state.mode, country: $('country').value, smart: $('smart').checked };
      FIELDS.forEach(function (id) { o[id] = $(id).value; });
      localStorage.setItem('gmvmax-check-v2', JSON.stringify(o));
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem('gmvmax-check-v2') || 'null');
      if (!o) return false;
      $('country').value = o.country || 'FR';
      applyMarket(o.market || 'EU', true);
      FIELDS.forEach(function (id) { if (o[id] !== undefined) $(id).value = o[id]; });
      $('smart').checked = !!o.smart;
      applyMode(o.mode || 'payouts');
      return true;
    } catch (e) { return false; }
  }
  function clearAll() {
    ['cost', 'gross', 'costAff', 'gmv', 'orders', 'items', 'creators', 'payout', 'unitCost', 'ship'].forEach(function (id) { $(id).value = ''; $(id).classList.remove('is-filled'); });
    ['ads', 'analytics', 'payouts'].forEach(function (k) { $('paste-' + k).value = ''; $('status-' + k).textContent = ''; });
    $('commission').value = '15'; $('refunds').value = '5';
  }
  function fillExample() {
    state.example = true;
    $('country').value = EXAMPLE.country;
    applyMarket(EXAMPLE.market, false);
    ['cost', 'gross', 'costAff', 'gmv', 'orders', 'items', 'creators', 'payout', 'unitCost', 'vat'].forEach(function (k) { $(k).value = EXAMPLE[k]; $(k).classList.add('is-filled'); });
    applyMode(EXAMPLE.mode);
    $('exampleNote').hidden = false;
    render();
  }
  function leaveExample() {
    if (!state.example) return;
    state.example = false;
    $('exampleNote').hidden = true;
  }
  var HASH = { us: 'US', uk: 'UK', eu: 'EU', europe: 'EU', fr: 'EU', de: 'EU', it: 'EU', es: 'EU', ie: 'EU', my: 'MY', malaysia: 'MY', id: 'ID', indonesia: 'ID' };
  function fromHash() {
    var h = (location.hash || '').replace('#', '').toLowerCase();
    if (h === 'example') { fillExample(); return; }
    if (!HASH[h]) return;
    leaveExample();
    if (['fr', 'de', 'it', 'es', 'ie'].indexOf(h) > -1) $('country').value = h.toUpperCase();
    applyMarket(HASH[h], true);
  }

  /* ---------- wiring ---------- */
  ['ads', 'analytics', 'payouts'].forEach(function (k) {
    var box = $('paste-' + k);
    box.addEventListener('input', function () { onPaste(k); });
  });
  FIELDS.forEach(function (id) { $(id).addEventListener('input', function () { $(id).classList.remove('is-filled'); leaveExample(); render(); }); });
  $('market').addEventListener('change', function () { leaveExample(); applyMarket($('market').value, true); });
  $('country').addEventListener('change', function () { var M = MARKETS[state.market]; if (M.countries) $('vat').value = String(M.countries[$('country').value]); render(); });
  $('smart').addEventListener('change', render);
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { applyMode(b.getAttribute('data-mode')); }); });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-example]')) { e.preventDefault(); fillExample(); var chk = $('check'); if (chk) chk.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (t.closest('[data-clear]')) { leaveExample(); clearAll(); applyMarket('EU', true); applyMode('payouts'); try { localStorage.removeItem('gmvmax-check-v2'); } catch (err) { /* ignore */ } }
    if (t.closest('[data-copy]')) {
      var r = compute(); if (r.missing) return;
      var text = resultLine(r), note = $('copyNote');
      var send = !!t.closest('[data-send]');
      var done = function () { if (note) note.textContent = send ? 'Copied. Paste it in your message to Dilshad.' : 'Copied. Paste it anywhere.'; };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
      else { fallbackCopy(text); done(); }
    }
  });
  function fallbackCopy(text) { var t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.className = 'visually-hidden'; document.body.appendChild(t); t.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } document.body.removeChild(t); }
  $('eaBench').addEventListener('change', render);

  var IS_PREVIEW = (function () { try { return window.self !== window.top || /claude/.test(location.hostname); } catch (e) { return true; } })();
  $('eaForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('eaEmail'), help = $('eaHelp'), btn = $('eaSubmit');
    var ok = email.checkValidity();
    email.setAttribute('aria-invalid', String(!ok));
    if (!ok) { help.textContent = 'That address looks incomplete. Write it as name@brand.com.'; email.focus(); return; }
    if (IS_PREVIEW) { help.textContent = 'Preview: nothing was sent. On check.clyvant.ai this joins the early-access list.'; return; }
    var r = compute();
    $('jfResult').value = ($('eaBench').checked && !r.missing) ? benchLine(r) : '';
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true; btn.textContent = 'Sending';
    fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: new FormData($('eaForm')) })
      .then(function () { help.textContent = 'Done. ' + email.value.trim() + ' is on the early-access list.'; btn.textContent = 'On the list'; btn.removeAttribute('aria-busy'); })
      .catch(function () { help.textContent = 'That did not go through. Try again in a minute.'; btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Get early access'; });
  });

  window.addEventListener('hashchange', fromHash);
  if (!load()) { applyMarket('EU', true); applyMode('payouts'); }
  fromHash();
  render();
})();

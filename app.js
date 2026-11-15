(function () {
  'use strict';
  var SITE = 'check.clyvant.ai';
  var FORM_URL = 'https://submit.jotform.com/submit/263176319018054';
  var STORE = 'gmvmax-check-v3';
  var DAY = 86400000;

  var MARKETS = {
    US: { name: 'United States', form: 'United States', cur: 'USD', locale: 'en-US', dec: 2, fee: 6, perOrder: 0, vat: 0, smart: true, vatLabel: 'Sales tax in your prices %', feeNote: 'Referral fee. TikTok’s table says 6%; some sellers see 8% since 4 Aug 2026.' },
    UK: { name: 'United Kingdom', form: 'United Kingdom', cur: 'GBP', locale: 'en-GB', dec: 2, fee: 9, perOrder: 0, vat: 20, vatLabel: 'VAT in your prices %', feeNote: 'Commission, most categories, since 2 Sep 2024.' },
    EU: { name: 'Europe', form: 'Europe', cur: 'EUR', locale: 'en-IE', dec: 2, fee: 9, perOrder: 0, vat: 20, vatLabel: 'VAT in your prices %', feeNote: 'Commission, most categories, since 8 Jan 2026.', countries: { FR: 20, DE: 19, IT: 22, ES: 21, IE: 23, OT: 20 } },
    MY: { name: 'Malaysia', form: 'Malaysia', cur: 'MYR', locale: 'en-MY', dec: 2, fee: 13.8, perOrder: 0.54, vat: 0, vatLabel: 'Tax in your prices %', feeNote: 'Commission by category plus the 3.78% transaction fee. RM0.54 per order.' },
    ID: { name: 'Indonesia', form: 'Indonesia', cur: 'IDR', locale: 'id-ID', dec: 0, fee: 16, perOrder: 1250, vat: 0, vatLabel: 'PPN in your prices %', feeNote: 'Platform plus dynamic commission. Rp1,250 per order.' }
  };
  var COUNTRY_NAME = { FR: 'France', DE: 'Germany', IT: 'Italy', ES: 'Spain', IE: 'Ireland', OT: 'Other EU country' };
  var PAGE_PLACE = { 'france': ['EU', 'FR'], 'germany': ['EU', 'DE'], 'italy': ['EU', 'IT'], 'spain': ['EU', 'ES'], 'ireland': ['EU', 'IE'], 'united kingdom': ['UK'], 'united states': ['US'], 'malaysia': ['MY'], 'indonesia': ['ID'] };

  /* Our shop in France. Orders placed 15 May to 14 Oct 2026, every one paid out.
     Payout and product cost come from Finance, Statements, View by orders. */
  var EXAMPLE = {
    market: 'EU', country: 'FR', mode: 'payouts', costMode: 'total', roi: 2.75, start: '2026-05-15', end: '2026-10-14',
    values: { cost: '9,234.07', gross: '25,379.49', gmv: '26,314.38', orders: '1,671', items: '2,079', creators: '20,571.26', payout: '13,406.21', vat: '20', prodTotal: '4,607.18', samples: '396', sampleCost: '2.23' }
  };
  var READS = ['cost', 'gross', 'costAff', 'gmv', 'orders', 'items', 'creators', 'payout'];
  var FIELDS = READS.concat(['vat', 'unitCost', 'prodTotal', 'samples', 'sampleCost', 'fee', 'commission', 'ship', 'refunds', 'perOrder']);
  var INTEGER = { orders: true, items: true, samples: true };
  var state = { market: 'EU', mode: 'payouts', costMode: 'item', example: false, roi: null, dates: null, src: {} };
  var $ = function (id) { return document.getElementById(id); };
  // Null-safe for pages cached before these elements existed.
  function setText(id, t) { var el = $(id); if (el) el.textContent = t; }
  function setHidden(id, h) { var el = $(id); if (el) el.hidden = h; }
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
  function val(id) { return parseNum($(id).value, !!INTEGER[id]); }
  function has(id) { return isFinite(val(id)); }
  function fmtMoney(n, dec) {
    var M = MARKETS[state.market];
    var d = dec !== undefined ? dec : (Math.abs(n) >= 1000 ? 0 : M.dec);
    if (M.dec === 0) d = 0;
    try { return new Intl.NumberFormat(M.locale, { style: 'currency', currency: M.cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
    catch (e) { return M.cur + ' ' + n.toFixed(d); }
  }
  function fmtPlain(n, integer) {
    var d = integer || MARKETS[state.market].dec === 0 ? 0 : 2;
    return new Intl.NumberFormat('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).format(n);
  }
  function unit() { return MARKETS[state.market].dec === 0 ? fmtMoney(1000, 0) : fmtMoney(1, 0); }
  function perUnit(x) { return MARKETS[state.market].dec === 0 ? fmtMoney(x * 1000, 0) : fmtMoney(x, 2); }
  function pct(x) { return Math.round(x * 100) + '%'; }
  function r2(x) { return x.toFixed(2); }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ---------- dates ---------- */
  var MON = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
  var MON_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\\.?';
  function utc(y, m, d) { var t = Date.UTC(y, m, d); var x = new Date(t); return (x.getUTCMonth() === m && x.getUTCDate() === d) ? t : NaN; }
  function datesIn(line) {
    var out = [], m, re;
    re = new RegExp('\\b' + MON_RE + '\\s+(\\d{1,2}),?\\s+(\\d{4})', 'gi');
    while ((m = re.exec(line))) out.push(utc(+m[3], MON[m[1].toLowerCase()], +m[2]));
    re = new RegExp('\\b(\\d{1,2})\\s+' + MON_RE + ',?\\s+(\\d{4})', 'gi');
    while ((m = re.exec(line))) out.push(utc(+m[3], MON[m[2].toLowerCase()], +m[1]));
    re = /\b(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})\b/g;
    while ((m = re.exec(line))) out.push(utc(+m[1], +m[2] - 1, +m[3]));
    re = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g;
    while ((m = re.exec(line))) {
      var a = +m[1], b = +m[2], dmy = state.market !== 'US' || a > 12;
      if (b > 12) dmy = false;
      out.push(dmy ? utc(+m[3], b - 1, a) : utc(+m[3], a - 1, b));
    }
    return out.filter(isFinite);
  }
  function findRange(text) {
    var L = linesOf(text);
    for (var i = 0; i < L.length; i++) {
      var ds = datesIn(L[i]);
      if (ds.length >= 2) return { start: Math.min.apply(null, ds), end: Math.max.apply(null, ds) };
    }
    return null;
  }
  function todayUTC() { var n = new Date(); return Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()); }
  function fmtDate(t, withYear) {
    var d = new Date(t);
    var s = d.getUTCDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()];
    return withYear ? s + ' ' + d.getUTCFullYear() : s;
  }
  // A window that TikTok has paid out: three months ending 31 days ago.
  function suggested() {
    var end = todayUTC() - 31 * DAY, start = end - 91 * DAY;
    return { start: start, end: end, text: fmtDate(start) + ' to ' + fmtDate(end) };
  }
  function isoDay(s) { var p = s.split('-'); return utc(+p[0], +p[1] - 1, +p[2]); }

  /* ---------- reading pasted Seller Centre pages ---------- */
  var CURRENCY = /(EUR|USD|GBP|MYR|IDR|RM|Rp|€|\$|£)/g;
  function linesOf(text) {
    return String(text || '').replace(/\r/g, '').split('\n')
      .map(function (s) { return s.replace(/[   ]/g, ' ').trim(); })
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
  function readPlace(L) {
    for (var i = 0; i < L.length - 1; i++) {
      var a = L[i].toLowerCase();
      if (a === 'seller centre' || a === 'seller center') { var p = PAGE_PLACE[L[i + 1].toLowerCase()]; if (p) return p; }
    }
    return null;
  }
  function readAds(text) {
    var L = linesOf(text);
    return { cost: after(L, 'Cost'), gross: after(L, 'Gross revenue'), costAff: after(L, 'Cost (affiliate)'), roi: after(L, 'ROI'), place: readPlace(L) };
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
    ads: { read: readAds, fields: { cost: 'ad cost', gross: 'gross revenue', costAff: 'ad cost on creators' }, need: ['cost', 'gross'] },
    analytics: { read: readAnalytics, fields: { gmv: 'GMV', orders: 'orders', items: 'items sold', creators: 'creators’ sales' }, need: ['gmv'] },
    payouts: { read: readPayouts, fields: { payout: 'payout amount' }, need: ['payout'] }
  };
  function list(a) { return a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]; }
  function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function flash(el) {
    if (reduceMotion) return;
    el.classList.remove('is-flash'); void el.offsetWidth; el.classList.add('is-flash');
  }
  function onPaste(kind) {
    var box = $('paste-' + kind), status = $('status-' + kind), R = READERS[kind];
    var text = box.value;
    if (!text.trim()) return;
    setText('boardMsg', '');
    leaveExample(kind);
    var m = detectMarket(text), switched = false;
    if (m && m !== state.market) { applyMarket(m, true); switched = true; }
    var got = R.read(text), read = [], missing = [], placeNote = '';
    if (got.place) {
      var pm = got.place[0], pc = got.place[1];
      if (pm !== state.market) { applyMarket(pm, true); switched = true; }
      if (pc && MARKETS[pm].countries && $('country').value !== pc) {
        $('country').value = pc;
        $('vat').value = String(MARKETS[pm].countries[pc]);
        placeNote = ' Country set to ' + COUNTRY_NAME[pc] + ', VAT ' + $('vat').value + '%.';
      }
    }
    Object.keys(R.fields).forEach(function (k) {
      var input = $(k);
      if (got[k] !== null && got[k] !== undefined) {
        var n = parseNum(got[k], !!INTEGER[k]);
        if (isFinite(n)) { input.value = fmtPlain(n, !!INTEGER[k]); input.classList.add('is-filled'); flash(input); state.src[k] = 'read'; read.push(R.fields[k]); return; }
      }
      if (R.need.indexOf(k) > -1) missing.push(R.fields[k]);
    });
    if (kind === 'ads') {
      var roi = got.roi !== null ? parseNum(got.roi) : NaN;
      state.roi = isFinite(roi) && roi > 0 && roi < 1000 ? roi : null;
      if (state.roi !== null) read.push('ROI');
    }
    if (kind === 'payouts') state.dates = findRange(text);
    if (!read.length) {
      status.setAttribute('data-state', 'bad');
      status.textContent = 'No numbers found. Check the page is in English and copy all of it with Ctrl+A, then Ctrl+C. Or type them in step 2.';
    } else {
      status.setAttribute('data-state', missing.length ? 'bad' : 'ok');
      if (!missing.length) box.value = '';
      status.textContent = 'Read ' + list(read) + '.' + (missing.length ? ' Type ' + list(missing) + ' in step 2.' : '') + (switched ? ' Market set to ' + MARKETS[state.market].name + '.' : '') + placeNote;
    }
    render();
  }

  /* ---------- market, mode, cost entry ---------- */
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
    setHidden('euNote', m !== 'EU');
    setHidden('shopsHint', m === 'EU');
    document.querySelectorAll('[data-cur]').forEach(function (el) { el.textContent = M.cur; });
  }
  function applyMode(mode) {
    state.mode = mode;
    document.querySelectorAll('[data-mode]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === mode)); });
    $('mode-payouts').hidden = mode !== 'payouts';
    $('mode-estimate').hidden = mode !== 'estimate';
    $('readPayout').hidden = mode !== 'payouts';
  }
  function applyCostMode(cm) {
    state.costMode = cm;
    document.querySelectorAll('[data-cost]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-cost') === cm)); });
    $('costItemWrap').hidden = cm !== 'item';
    $('costTotalWrap').hidden = cm !== 'total';
  }

  /* ---------- the math ---------- */
  function compute() {
    var C = val('cost'), G = val('gross'), T = val('gmv'), N = val('orders'), U = val('items');
    var A = val('creators'), CA = val('costAff'), vp = val('vat');
    var missing = [];
    if (!(C > 0)) missing.push('ad cost');
    if (!(G >= 0)) missing.push('sales credited to GMV Max');
    if (!(T > 0)) missing.push('shop sales (GMV)');
    var product = NaN;
    if (state.costMode === 'item') {
      var p = val('unitCost');
      if (!(U > 0)) missing.push('items sold');
      if (!(p >= 0)) missing.push('product cost per item');
      product = U * p;
    } else {
      product = val('prodTotal');
      if (!(product >= 0)) missing.push('product cost');
    }
    if (!(vp >= 0)) missing.push('VAT %');
    var sU = val('samples'), samples = 0;
    if (sU > 0) {
      var per = has('sampleCost') ? val('sampleCost') : (state.costMode === 'item' ? val('unitCost') : NaN);
      if (!(per >= 0)) missing.push('cost per sample'); else samples = sU * per;
    }
    var v = vp / 100, kept, parts;
    if (state.mode === 'payouts') {
      var P = val('payout');
      if (!isFinite(P)) missing.push('payout amount');
      if (missing.length) return { missing: missing };
      var vatP = T * v / (1 + v);
      kept = P - vatP - product - samples;
      parts = { cut: T - P, vat: vatP, product: product, samples: samples, P: P };
    } else {
      var ship = val('ship');
      if (!(N > 0)) missing.push('orders');
      if (!isFinite(ship)) missing.push('shipping per order');
      if (missing.length) return { missing: missing };
      var r = (val('refunds') || 0) / 100;
      var sales = T * (1 - r);
      var vatQ = sales * v / (1 + v);
      var fees = sales * (val('fee') || 0) / 100 + ($('smart').checked ? sales * 0.035 : 0) + N * (1 - r) * (val('perOrder') || 0);
      var creator = (isFinite(A) ? A : 0) * (1 - r) * (val('commission') || 0) / 100;
      var shipping = N * ship;
      kept = sales - vatQ - fees - creator - shipping - product - samples;
      parts = { cut: (T - sales) + fees + creator + shipping, vat: vatQ, product: product, samples: samples };
    }
    var m = kept / T, back = m * G;
    var res = {
      C: C, G: G, T: T, m: m, kept: kept, back: back, parts: parts, samples: samples,
      credit: G / T, tiktokROI: G / C, realROI: Math.max(0, back / C), net: back - C, be: m > 0 ? 1 / m : Infinity,
      creators: isFinite(A) && A >= 0 ? A / T : null, adsOnCreators: isFinite(CA) && CA >= 0 ? CA / C : null
    };
    res.verdict = res.realROI >= 1.3 ? 'Scale' : (res.realROI >= 1 ? 'Keep' : 'Cut');
    return res;
  }

  /* ---------- the checks in step 2 ---------- */
  function required(id) {
    if (id === 'cost' || id === 'gross' || id === 'gmv') return true;
    if (id === 'orders') return state.mode === 'estimate';
    if (id === 'items') return state.costMode === 'item';
    if (id === 'payout') return state.mode === 'payouts';
    return false;
  }
  function setCheck(id, st, text) {
    var li = $(id);
    li.setAttribute('data-state', st);
    li.querySelector('.read__src').textContent = text;
  }
  function runChecks() {
    READS.forEach(function (id) {
      var li = document.querySelector('[data-for="' + id + '"]');
      var st = has(id) ? (state.src[id] === 'read' || state.example ? 'ok' : 'typed') : (required(id) ? 'todo' : 'na');
      li.setAttribute('data-state', st);
    });
    var C = val('cost'), G = val('gross'), T = val('gmv'), P = val('payout');
    var res = [];
    // 1. TikTok's own ROI
    if (C > 0 && G >= 0) {
      var calc = G / C;
      if (state.roi === null) res.push(['ck-roi', 'na', 'No ROI on your paste to compare. These numbers give ' + r2(calc) + '.']);
      else if (Math.abs(calc - state.roi) <= 0.015) res.push(['ck-roi', 'ok', 'TikTok shows ' + r2(state.roi) + ', the numbers give ' + r2(calc) + '.']);
      else res.push(['ck-roi', 'warn', 'TikTok shows ' + r2(state.roi) + ', these numbers give ' + r2(calc) + '. Check ad cost and gross revenue.']);
    } else res.push(['ck-roi', 'todo', 'Paste the Ads dashboard']);
    // 2. Ad sales inside shop sales
    if (T > 0 && G >= 0) {
      if (G <= T * 1.005) res.push(['ck-credit', 'ok', pct(G / T) + ' of shop sales were counted as ad sales.']);
      else res.push(['ck-credit', 'warn', 'Ad sales are more than shop sales. Use the same dates and country on both pages, over a few months: on a few days the two don’t line up.']);
    } else res.push(['ck-credit', 'todo', 'Needs both pages']);
    // 3. Payout against sales
    if (state.mode === 'estimate') res.push(['ck-payout', 'na', 'Estimate: TikTok’s cut comes from fee presets, not your payouts.', false]);
    else if (T > 0 && isFinite(P)) {
      var share = P / T;
      if (share > 1.005) res.push(['ck-payout', 'warn', 'Payout is more than shop sales. Use the same dates and the same country on all three pages, not “All markets”.']);
      else if (share > 0.85) res.push(['ck-payout', 'warn', 'Payout is ' + pct(share) + ' of shop sales, more than TikTok usually pays. Check the Finance page shows this country, not “All markets”, and the same dates.']);
      else if (share < 0.2) res.push(['ck-payout', 'warn', 'Payout is only ' + pct(share) + ' of shop sales. Check the Finance dates.']);
      else res.push(['ck-payout', 'ok', 'TikTok paid out ' + pct(share) + ' of shop sales.']);
    } else res.push(['ck-payout', 'todo', 'Needs the Finance page']);
    // 4. Dates
    if (state.example) res.push(['ck-dates', 'ok', 'Orders placed 15 May to 14 Oct 2026, read order by order.']);
    else if (state.mode === 'estimate') res.push(['ck-dates', 'na', 'Estimate: any dates work, today included.', false]);
    else if (state.dates) {
      var ago = Math.round((todayUTC() - state.dates.end) / DAY), len = Math.round((state.dates.end - state.dates.start) / DAY) + 1;
      if (ago < 30) res.push(['ck-dates', 'warn', 'Your dates end ' + fmtDate(state.dates.end) + '. TikTok hasn’t paid out the recent orders yet, so the Finance page can’t include them. Use ' + suggested().text + ', or switch to “Recent (estimate)”.']);
      else if (len < 28) res.push(['ck-dates', 'warn', 'Only ' + len + ' days. Use 2 to 6 months so the payout timing evens out.']);
      else res.push(['ck-dates', 'ok', fmtDate(state.dates.start) + ' to ' + fmtDate(state.dates.end, true) + ', ended ' + ago + ' days ago.']);
    } else if (isFinite(P)) res.push(['ck-dates', 'na', 'Couldn’t see your dates. Make sure they ended 30+ days ago: ' + suggested().text + '.']);
    else res.push(['ck-dates', 'todo', 'Read from the Finance page']);
    // 5. Costs
    var costOK = has('vat') && (state.costMode === 'item' ? has('unitCost') : has('prodTotal'));
    if (costOK) {
      var sU = val('samples');
      res.push(['ck-costs', 'ok', 'VAT ' + val('vat') + '%, product cost' + (sU > 0 ? ', ' + fmtPlain(sU, true) + ' free samples.' : '. No free samples added.')]);
    } else res.push(['ck-costs', 'todo', 'Add VAT and product cost']);
    res.forEach(function (c) { setCheck(c[0], c[1], c[2]); });
    return res;
  }

  /* ---------- drawing ---------- */
  var shown = { complete: false, ran: false };
  function render() {
    var r = compute(), checks = runChecks(), box = $('result');
    var M = MARKETS[state.market];
    var where = M.countries ? COUNTRY_NAME[$('country').value] : M.name;
    $('boardCap').textContent = state.example ? 'Our shop in France, orders from 15 May to 14 Oct 2026' : 'Your shop, ' + where;
    $('exampleNote').hidden = !state.example;
    $('payoutSrc').textContent = state.example ? 'Finance, Statements, by order' : 'Finance, Payout amount';
    var counted = checks.filter(function (c) { return c[3] !== false; });
    var passed = counted.filter(function (c) { return c[1] === 'ok'; }).length;
    var pill = $('checkPill');
    if (r.missing) { pill.setAttribute('data-state', 'todo'); $('checkPillText').textContent = 'Waiting for your numbers'; }
    else { pill.setAttribute('data-state', passed === counted.length ? 'ok' : 'warn'); $('checkPillText').textContent = passed + ' of ' + counted.length + ' checks passed' + (state.mode === 'estimate' ? ' · estimate' : ''); }

    if (r.missing) {
      box.innerHTML = '<div class="result__empty"><p class="result__cap">' + esc(state.example ? 'Our shop' : 'Your shop') + '</p><p>Still needed: ' + esc(list(r.missing)) + '.</p><p><button type="button" class="textbtn" data-example>See our shop’s numbers</button></p></div>';
      shown.complete = false;
      $('jfResult').value = '';
      save();
      return;
    }
    var made = r.net >= 0;
    var cap = state.example ? 'Our shop in France · 15 May to 14 Oct 2026' : 'Your shop · ' + where + (state.mode === 'estimate' ? ' · estimate' : '');
    var vline;
    if (r.verdict === 'Cut') vline = isFinite(r.be) ? 'Ads lose money. You break even at ROI ' + r2(r.be) + ' and TikTok shows ' + r2(r.tiktokROI) + '. Raise your ROI target to at least ' + r2(r.be) + ', or cut the budget.' : 'Each sale loses money before ads, so no ROI target fixes this. Fix price or costs first.';
    else if (r.verdict === 'Keep') vline = 'Ads pay for themselves, barely. Each ' + unit() + ' of ads brings back ' + perUnit(r.realROI) + '. Hold the budget until it brings back ' + perUnit(1.3) + '.';
    else vline = 'Ads make money. Each ' + unit() + ' of ads brings back ' + perUnit(r.realROI) + ' after every cost. There is room to spend more.';
    var T = r.T, P = r.parts;
    var segs = [
      ['c-cut', 'Fees, commission, shipping, refunds', P.cut],
      ['c-vat', 'VAT', P.vat],
      ['c-prod', 'Product', P.product],
      ['c-samp', 'Free samples', P.samples],
      ['c-kept', 'Kept before ads', Math.max(0, r.kept)]
    ].filter(function (s) { return s[2] > 0.0005 * T; });
    var total = segs.reduce(function (a, s) { return a + s[2]; }, 0) || 1;
    var bar = '<div class="bar"><p class="bar__cap">Where each ' + esc(unit()) + ' of sales went</p><div class="bar__track" role="img" aria-label="' + esc(segs.map(function (s) { return s[1] + ' ' + perUnit(s[2] / T); }).join(', ')) + '">' +
      segs.map(function (s) { return '<span class="bar__seg ' + s[0] + '" style="--w:' + (s[2] / total * 100).toFixed(2) + '%"></span>'; }).join('') + '</div>' +
      '<ul class="bar__legend">' + segs.map(function (s) { return '<li><span><i class="sw ' + s[0] + '" aria-hidden="true"></i>' + esc(s[1]) + '</span><span>' + esc(perUnit(s[2] / T)) + '</span></li>'; }).join('') + '</ul></div>';
    var facts = '<div><dt>Sales counted as GMV Max sales</dt><dd>' + pct(r.credit) + '</dd></div>';
    if (r.creators !== null) facts += '<div><dt>Sales through creators</dt><dd>' + pct(r.creators) + '</dd></div>';
    if (r.adsOnCreators !== null) facts += '<div><dt>Ad cost on creators’ videos</dt><dd>' + pct(r.adsOnCreators) + '</dd></div>';
    box.innerHTML =
      '<p class="result__cap">' + esc(cap) + '</p>' +
      '<span class="result__label">Real ROI</span>' +
      '<span class="result__big" id="bigROI">' + r2(r.realROI) + '</span>' +
      '<p class="result__tt">TikTok shows <s>' + r2(r.tiktokROI) + '</s></p>' +
      '<dl class="result__rows">' +
      '<div><dt>Break-even ROI</dt><dd>' + (isFinite(r.be) ? r2(r.be) : 'none') + '</dd></div>' +
      '<div><dt>Ads</dt><dd>' + esc(fmtMoney(r.C)) + '</dd></div>' +
      '<div><dt>Brought back after every cost</dt><dd>' + esc(fmtMoney(Math.max(0, r.back))) + '</dd></div>' +
      '<div class="' + (made ? 'is-made' : 'is-loss') + '"><dt>' + (made ? 'Made' : 'Lost') + '</dt><dd>' + esc(fmtMoney(Math.abs(r.net))) + '</dd></div>' +
      '</dl>' + bar +
      '<div class="verdict verdict--' + r.verdict.toLowerCase() + '"><span class="verdict__word"><i class="verdict__dot" aria-hidden="true"></i>' + r.verdict + '</span><p>' + esc(vline) + '</p></div>' +
      '<dl class="result__facts">' + facts + '</dl>' +
      '<div class="result__actions"><button type="button" class="btn btn--lime" data-copy>Copy my result</button><a class="btn btn--line" data-copy data-send href="https://www.linkedin.com/in/dilshad-ali-ceo/" rel="noopener" target="_blank">Send it to Dilshad</a>' + (state.example ? '' : '<button type="button" class="btn btn--line btn--full" data-add-shop>Add to my shops</button>') + '</div>' +
      '<p class="result__note" aria-live="polite" id="copyNote"></p>';
    if (!shown.complete && shown.ran) countDown(r);
    shown.complete = true;
    $('jfResult').value = $('eaBench').checked ? benchLine(r) : '';
    save();
  }
  function countDown(r) {
    var el = $('bigROI');
    if (!el || reduceMotion || !window.requestAnimationFrame || document.hidden) return;
    var from = r.tiktokROI, to = r.realROI, t0 = null, dur = 1300;
    el.textContent = r2(from);
    // If frames are paused (a background tab), the real number still lands.
    setTimeout(function () { if (document.body.contains(el)) el.textContent = r2(to); }, 700 + dur + 300);
    function step(t) {
      if (t0 === null) t0 = t;
      var k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      if (!document.body.contains(el)) return;
      el.textContent = r2(from + (to - from) * e);
      if (k < 1) requestAnimationFrame(step);
    }
    setTimeout(function () { requestAnimationFrame(step); }, 700);
  }
  function resultLine(r) {
    return 'GMV Max check (' + MARKETS[state.market].name + (state.mode === 'estimate' ? ', estimate' : '') + '): TikTok shows ROI ' + r2(r.tiktokROI) + '. After TikTok’s cut, VAT, product cost' + (r.samples > 0 ? ' and free samples' : '') + ', the real ROI is ' + r2(r.realROI) + '. Break-even ROI: ' + (isFinite(r.be) ? r2(r.be) : 'none') + '. GMV Max was credited with ' + pct(r.credit) + ' of all sales. Check yours: ' + SITE;
  }
  function benchLine(r) {
    return [state.market, state.mode, 'credit=' + r.credit.toFixed(3), 'roi=' + r.tiktokROI.toFixed(2), 'real=' + r.realROI.toFixed(2), 'be=' + (isFinite(r.be) ? r.be.toFixed(2) : 'inf'), 'kept=' + r.m.toFixed(3), 'samples=' + (r.samples > 0 ? 'yes' : 'no'), 'creators=' + (r.creators !== null ? r.creators.toFixed(3) : 'na'), 'adsOnCreators=' + (r.adsOnCreators !== null ? r.adsOnCreators.toFixed(3) : 'na'), state.example ? 'example' : 'user'].join('; ');
  }

  /* ---------- several shops: a running total ---------- */
  var SHOPS = 'gmvmax-shops-v1', shops = [];
  function money(n, mk) {
    var M = MARKETS[mk], d = (Math.abs(n) >= 1000 || M.dec === 0) ? 0 : M.dec;
    try { return new Intl.NumberFormat(M.locale, { style: 'currency', currency: M.cur, minimumFractionDigits: d, maximumFractionDigits: d }).format(n); }
    catch (e) { return M.cur + ' ' + n.toFixed(d); }
  }
  function loadShops() {
    try {
      var a = JSON.parse(localStorage.getItem(SHOPS) || '[]');
      shops = Array.isArray(a) ? a.filter(function (x) { return x && MARKETS[x.market] && x.C > 0 && isFinite(x.G) && isFinite(x.back); }) : [];
    } catch (e) { shops = []; }
  }
  function saveShops() { try { localStorage.setItem(SHOPS, JSON.stringify(shops)); } catch (e) { /* storage unavailable */ } }
  // Real ROI = brought back ÷ ad cost; break-even = credited sales ÷ brought back (= 1 ÷ kept per 1 of sales).
  function sums(o) {
    var real = Math.max(0, o.back / o.C);
    return { tt: o.G / o.C, real: real, be: o.back > 0 ? o.G / o.back : Infinity, net: o.back - o.C };
  }
  function totals() {
    var t = {}, order = [];
    shops.forEach(function (x) {
      var k = MARKETS[x.market].cur;
      if (!t[k]) { t[k] = { market: x.market, n: 0, C: 0, G: 0, back: 0, est: false }; order.push(k); }
      t[k].n++; t[k].C += x.C; t[k].G += x.G; t[k].back += x.back;
      if (x.mode === 'estimate') t[k].est = true;
    });
    return order.map(function (k) { return t[k]; });
  }
  function signed(n, mk) { return (n >= 0 ? '+' : '−') + money(Math.abs(n), mk); }
  function renderShops() {
    var box = $('shops');
    if (!box) return;
    if (!shops.length) { box.hidden = true; setText('shopsNote', ''); return; }
    box.hidden = false;
    var T = totals();
    var head = '<thead><tr><th scope="col">Shop</th><th scope="col">TikTok ROI</th><th scope="col">Real ROI</th><th scope="col">Break-even</th><th scope="col">Ad cost</th><th scope="col">Brought back</th><th scope="col">Made or lost</th><th scope="col">Checks</th><th scope="col"><span class="visually-hidden">Remove</span></th></tr></thead>';
    var body = shops.map(function (x, i) {
      var c = sums(x);
      return '<tr><th scope="row">' + esc(x.name) + (x.mode === 'estimate' ? '<span class="shops__est">estimate</span>' : '') + '</th>' +
        '<td>' + r2(c.tt) + '</td><td><b>' + r2(c.real) + '</b></td><td>' + (isFinite(c.be) ? r2(c.be) : 'none') + '</td>' +
        '<td>' + esc(money(x.C, x.market)) + '</td><td>' + esc(money(Math.max(0, x.back), x.market)) + '</td>' +
        '<td class="' + (c.net >= 0 ? 'made' : 'loss') + '">' + esc(signed(c.net, x.market)) + '</td>' +
        '<td>' + x.passed + ' of ' + x.checks + '</td>' +
        '<td><button type="button" class="shops__x" data-remove-shop="' + i + '" aria-label="Remove ' + esc(x.name) + '">×</button></td></tr>';
    }).join('');
    var foot = T.map(function (t) {
      var c = sums(t);
      return '<tr><th scope="row">All ' + t.n + ' shop' + (t.n > 1 ? 's' : '') + (T.length > 1 ? ' in ' + MARKETS[t.market].cur : '') + '</th>' +
        '<td>' + r2(c.tt) + '</td><td>' + r2(c.real) + '</td><td>' + (isFinite(c.be) ? r2(c.be) : 'none') + '</td>' +
        '<td>' + esc(money(t.C, t.market)) + '</td><td>' + esc(money(Math.max(0, t.back), t.market)) + '</td>' +
        '<td class="' + (c.net >= 0 ? 'made' : 'loss') + '">' + esc(signed(c.net, t.market)) + '</td><td></td><td></td></tr>';
    }).join('');
    $('shopsTable').innerHTML = head + '<tbody>' + body + '</tbody><tfoot>' + foot + '</tfoot>';
  }
  function totalLine() {
    return totals().map(function (t) {
      var c = sums(t);
      return 'GMV Max check, ' + t.n + ' shop' + (t.n > 1 ? 's' : '') + (t.est ? ', some estimated' : '') + ': TikTok shows ROI ' + r2(c.tt) + '. After every cost the real ROI is ' + r2(c.real) + '. Break-even ROI: ' + (isFinite(c.be) ? r2(c.be) : 'none') + '. ' + (c.net >= 0 ? 'Made ' : 'Lost ') + money(Math.abs(c.net), t.market) + ' on ' + money(t.C, t.market) + ' of ads. Check yours: ' + SITE;
    }).join('\n');
  }
  function addShop() {
    var r = compute();
    if (r.missing || state.example) return;
    var M = MARKETS[state.market];
    var base = M.countries ? COUNTRY_NAME[$('country').value] : M.name;
    var same = shops.filter(function (x) { return x.base === base; }).length;
    var counted = runChecks().filter(function (c) { return c[3] !== false; });
    var name = same ? base + ' ' + (same + 1) : base;
    shops.push({ name: name, base: base, market: state.market, mode: state.mode, C: r.C, G: r.G, T: r.T, kept: r.kept, back: r.back, passed: counted.filter(function (c) { return c[1] === 'ok'; }).length, checks: counted.length });
    saveShops();
    renderShops();
    // Ready for the next shop: keep market, costs per item and sample cost; clear this shop's numbers.
    ['cost', 'gross', 'costAff', 'gmv', 'orders', 'items', 'creators', 'payout', 'prodTotal', 'samples'].forEach(function (id) { $(id).value = ''; $(id).classList.remove('is-filled'); });
    ['ads', 'analytics', 'payouts'].forEach(function (k) { $('paste-' + k).value = ''; $('status-' + k).textContent = ''; $('status-' + k).removeAttribute('data-state'); });
    state.roi = null; state.dates = null; state.src = {};
    setText('boardMsg', name + ' is in your shops (' + shops.length + ' so far). Paste the next shop’s three pages' + (M.countries ? ' after switching the country in Seller Centre.' : '.'));
    render();
    var b = document.querySelector('.board');
    if (b && b.scrollIntoView) b.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
  }
  function copyText(text, note, msg) {
    var done = function () { if (note) note.textContent = msg; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { fallbackCopy(text); done(); });
    else { fallbackCopy(text); done(); }
  }

  /* ---------- memory, example, links ---------- */
  function save() {
    if (state.example) return;
    try {
      var o = { market: state.market, mode: state.mode, costMode: state.costMode, country: $('country').value, smart: $('smart').checked, roi: state.roi, dates: state.dates, src: state.src, v: {} };
      FIELDS.forEach(function (id) { o.v[id] = $(id).value; });
      localStorage.setItem(STORE, JSON.stringify(o));
    } catch (e) { /* storage unavailable */ }
  }
  function load() {
    try {
      var o = JSON.parse(localStorage.getItem(STORE) || 'null');
      if (!o || !o.v) return false;
      var any = READS.some(function (id) { return o.v[id]; });
      if (!any) return false;
      $('country').value = o.country || 'FR';
      applyMarket(o.market || 'EU', false);
      FIELDS.forEach(function (id) { if (o.v[id] !== undefined) $(id).value = o.v[id]; });
      $('smart').checked = !!o.smart;
      state.roi = typeof o.roi === 'number' ? o.roi : null;
      state.dates = o.dates && isFinite(o.dates.end) ? o.dates : null;
      state.src = o.src || {};
      READS.forEach(function (id) { $(id).classList.toggle('is-filled', state.src[id] === 'read' && has(id)); });
      applyMode(o.mode || 'payouts');
      applyCostMode(o.costMode || 'item');
      return true;
    } catch (e) { return false; }
  }
  function clearAll() {
    ['cost', 'gross', 'costAff', 'gmv', 'orders', 'items', 'creators', 'payout', 'unitCost', 'prodTotal', 'samples', 'sampleCost', 'ship'].forEach(function (id) { $(id).value = ''; $(id).classList.remove('is-filled'); });
    ['ads', 'analytics', 'payouts'].forEach(function (k) { $('status-' + k).textContent = ''; $('status-' + k).removeAttribute('data-state'); });
    $('commission').value = '15'; $('refunds').value = '5';
    state.roi = null; state.dates = null; state.src = {};
  }
  function fillExample() {
    clearAll();
    setText('boardMsg', '');
    ['ads', 'analytics', 'payouts'].forEach(function (k) { $('paste-' + k).value = ''; });
    state.example = true;
    $('country').value = EXAMPLE.country;
    applyMarket(EXAMPLE.market, true);
    Object.keys(EXAMPLE.values).forEach(function (k) { $(k).value = EXAMPLE.values[k]; if (READS.indexOf(k) > -1) $(k).classList.add('is-filled'); });
    state.roi = EXAMPLE.roi;
    state.dates = { start: isoDay(EXAMPLE.start), end: isoDay(EXAMPLE.end) };
    applyMode(EXAMPLE.mode);
    applyCostMode(EXAMPLE.costMode);
    var st = { ads: 'Read ad cost, gross revenue and ROI from our page.', analytics: 'Read GMV, orders, items sold and creators’ sales from our page.', payouts: 'Read the payout for every order placed in our dates.' };
    Object.keys(st).forEach(function (k) { $('status-' + k).textContent = st[k]; $('status-' + k).setAttribute('data-state', 'ok'); });
    shown.complete = false;
    render();
  }
  // Leaving the example clears all of our numbers, so yours never mix with ours.
  function leaveExample() {
    if (!state.example) return false;
    state.example = false;
    clearAll();
    applyMarket(state.market, true);
    applyCostMode('item');
    return true;
  }
  var HASH = { us: 'US', uk: 'UK', eu: 'EU', europe: 'EU', fr: 'EU', de: 'EU', it: 'EU', es: 'EU', ie: 'EU', my: 'MY', malaysia: 'MY', id: 'ID', indonesia: 'ID' };
  function fromHash() {
    var h = (location.hash || '').replace('#', '').toLowerCase();
    if (h === 'example') { fillExample(); return true; }
    if (!HASH[h]) return false;
    leaveExample();
    if (['fr', 'de', 'it', 'es', 'ie'].indexOf(h) > -1) $('country').value = h.toUpperCase();
    applyMarket(HASH[h], true);
    render();
    return true;
  }

  /* ---------- wiring ---------- */
  ['ads', 'analytics', 'payouts'].forEach(function (k) {
    $('paste-' + k).addEventListener('input', function () { onPaste(k); });
  });
  FIELDS.forEach(function (id) {
    $(id).addEventListener('input', function () {
      if (state.example) {
        var keep = $(id).value;
        leaveExample();
        $(id).value = keep;
      }
      $(id).classList.remove('is-filled');
      if (READS.indexOf(id) > -1) state.src[id] = 'typed';
      render();
    });
  });
  $('market').addEventListener('change', function () { leaveExample(); applyMarket($('market').value, true); render(); });
  $('country').addEventListener('change', function () { leaveExample(); var M = MARKETS[state.market]; if (M.countries) $('vat').value = String(M.countries[$('country').value]); render(); });
  $('smart').addEventListener('change', render);
  document.querySelectorAll('[data-mode]').forEach(function (b) { b.addEventListener('click', function () { applyMode(b.getAttribute('data-mode')); render(); }); });
  document.querySelectorAll('[data-cost]').forEach(function (b) { b.addEventListener('click', function () { applyCostMode(b.getAttribute('data-cost')); render(); }); });
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!(t instanceof Element)) return;
    if (t.closest('[data-example]')) { e.preventDefault(); fillExample(); }
    if (t.closest('[data-clear]')) {
      e.preventDefault();
      leaveExample();
      clearAll();
      ['ads', 'analytics', 'payouts'].forEach(function (k) { $('paste-' + k).value = ''; });
      try { localStorage.removeItem(STORE); } catch (err) { /* ignore */ }
      render();
      $('paste-ads').focus();
    }
    if (t.closest('[data-copy]')) {
      var r = compute(); if (r.missing) return;
      var send = !!t.closest('[data-send]');
      copyText(resultLine(r), $('copyNote'), send ? 'Copied. Paste it in your message to Dilshad.' : 'Copied. Paste it anywhere.');
    }
    if (t.closest('[data-add-shop]')) { e.preventDefault(); addShop(); }
    var rm = t.closest('[data-remove-shop]');
    if (rm) { shops.splice(+rm.getAttribute('data-remove-shop'), 1); saveShops(); renderShops(); }
    if (t.closest('[data-clear-shops]')) { shops = []; saveShops(); renderShops(); }
    if (t.closest('[data-copy-total]')) copyText(totalLine(), $('shopsNote'), 'Copied the total. Paste it anywhere.');
  });
  function fallbackCopy(text) { var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.className = 'visually-hidden'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) { /* ignore */ } document.body.removeChild(ta); }
  $('eaBench').addEventListener('change', render);

  var IS_PREVIEW = (function () { try { return window.self !== window.top || /claude/.test(location.hostname) || location.protocol === 'file:'; } catch (e) { return true; } })();
  $('eaForm').addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = $('eaEmail'), help = $('eaHelp'), btn = $('eaSubmit');
    var ok = email.checkValidity() && email.value.trim().length > 3;
    email.setAttribute('aria-invalid', String(!ok));
    if (!ok) { help.textContent = 'That address looks incomplete. Write it as name@brand.com.'; email.focus(); return; }
    if (IS_PREVIEW) { help.textContent = 'Preview: nothing was sent. On check.clyvant.ai this joins the early-access list.'; return; }
    var r = compute();
    $('jfResult').value = ($('eaBench').checked && !r.missing) ? benchLine(r) : '';
    btn.setAttribute('aria-busy', 'true'); btn.disabled = true; btn.textContent = 'Sending';
    fetch(FORM_URL, { method: 'POST', mode: 'no-cors', body: new FormData($('eaForm')) })
      .then(function () { help.textContent = 'Done. ' + email.value.trim() + ' is on the early-access list.'; btn.textContent = 'On the list'; btn.removeAttribute('aria-busy'); })
      .catch(function () { help.textContent = 'That didn’t go through. Try again in a minute.'; btn.disabled = false; btn.removeAttribute('aria-busy'); btn.textContent = 'Get early access'; });
  });

  /* ---------- start ---------- */
  var board = document.querySelector('.board');
  if ('IntersectionObserver' in window && !reduceMotion) {
    board.classList.add('js-anim');
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.disconnect();
        shown.ran = true;
        board.classList.add('is-run');
        var r = compute();
        if (!r.missing) countDown(r);
      });
    }, { threshold: 0.18 });
    io.observe(board);
  } else {
    shown.ran = true;
  }
  setText('suggestDates', suggested().text);
  loadShops();
  renderShops();
  window.addEventListener('hashchange', fromHash);
  applyMarket('EU', true);
  applyMode('payouts');
  applyCostMode('item');
  if (!fromHash()) {
    if (!load()) fillExample();
    else render();
  }
})();

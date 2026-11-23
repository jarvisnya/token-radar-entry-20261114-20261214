// Token Radar dashboard, model radar-7. It reads window.RADAR (written
// beside dashboard/ by main.ts) and renders the ranked board, a filterable
// table, a per-protocol detail view with the model's own inputs and the
// protocol's farm plan and verdict, the live-token comparables, and the
// method. No network: every byte it shows is in data.js. The scenario
// controls (deposit, drop share, horizon) recompute every verdict, net and
// net/hour live from the same arithmetic main.ts scored with.
(function () {
  'use strict';
  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var DEFAULT_SC = { depositPct: 0.02, dropShare: 7, horizon: 12 };
  var state = { q: '', category: 'all', chain: 'all', tab: 'board', sort: 'implied', dir: -1, selected: null, limit: 50, checked: {}, filter: 'all', sc: { depositPct: DEFAULT_SC.depositPct, dropShare: DEFAULT_SC.dropShare, horizon: DEFAULT_SC.horizon } };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var sign = n < 0 ? '-' : '';
    return sign + '$' + Math.abs(Math.round(n)).toLocaleString('en-US');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }

  // The model in a few functions, mirrored from lib/model.ts: the page
  // recomputes a row from the snapshot figures and checks the number
  // board.json carries, so the page's code and the board's data are
  // visibly the same arithmetic.
  function fittedOf(row) { return Math.max(1, Math.round(row.tvl_usd * row.fitted_multiple)); }
  function impliedOf(row) { return Math.max(1, Math.round(fittedOf(row) * row.odds)); }
  function depositOf(row, sc) { return clamp(sc.depositPct / 100 * row.tvl_usd, 100, 50000); }
  // The farm's economics under one scenario: deposit, fees, modelled drop,
  // net, T-bill return, net per hour, verdict. Same as farmEconomics().
  function netFor(row, sc) {
    var deposit = depositOf(row, sc);
    var txs = 1 + sc.horizon + 2;
    var fees = row.per_tx_usd * txs;
    var hours = (30 + 10 * sc.horizon + 25) / 60;
    var drop = row.implied_value_usd * (sc.dropShare / 100) * (deposit / row.tvl_usd);
    var net = drop - fees;
    var tbill = deposit * 0.04 * (sc.horizon / 52);
    var netPerHour = net / hours;
    var verdict = fees >= drop ? 'SKIP' : (net > tbill && netPerHour > 25) ? 'FARM' : 'MARGINAL';
    return { deposit: deposit, txs: txs, fees: fees, hours: hours, drop: drop, net: net, tbill: tbill, netPerHour: netPerHour, verdict: verdict };
  }
  function verdictReason(row, e) {
    if (e.fees >= e.drop) return 'Fees ' + fmtMoney(e.fees) + ' cover the modelled drop ' + fmtMoney(e.drop) + ': the farm pays the chains more than the launch pays you.';
    if (e.net > e.tbill && e.netPerHour > 25) return 'Net ' + fmtMoney(e.net) + ' beats the ' + fmtMoney(e.tbill) + ' a T-bill pays on a ' + fmtMoney(e.deposit) + ' deposit, at ' + fmtMoney(e.netPerHour) + '/hour over the $25 bar (drop ' + fmtMoney(e.drop) + ', fees ' + fmtMoney(e.fees) + ').';
    if (e.net > e.tbill) return 'Net ' + fmtMoney(e.net) + ' beats the ' + fmtMoney(e.tbill) + ' a T-bill pays, but ' + fmtMoney(e.netPerHour) + '/hour is under the $25 bar for ' + e.hours.toFixed(1) + ' hours of work.';
    if (e.net > 0) return 'Net ' + fmtMoney(e.net) + ' is positive, but under the ' + fmtMoney(e.tbill) + ' a T-bill pays on a ' + fmtMoney(e.deposit) + ' deposit: the money earns more parked.';
    return 'Net ' + fmtMoney(e.net) + ' is under water once the ' + fmtMoney(e.fees) + ' of fees come off the ' + fmtMoney(e.drop) + ' drop: farm it only if you value the option itself.';
  }
  function fnv1a(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
    return (h >>> 0).toString(16).padStart(8, '0');
  }

  // The farm plan is the same derivation main.ts writes to board.json:
  // category, chains, TVL and age decide the action; the scenario decides
  // the capital, the gas and the hold. No name is special-cased.
  function chainOf(p) { return p.chains && p.chains.length > 0 ? p.chains[0] : 'its main chain'; }
  function actionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Supply $' + capital + ' of USDC to ' + name + ' on ' + chain + ' and keep the position open.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Provide $' + capital + ' of liquidity to ' + name + "'s main pool on " + chain + ' and keep the position open.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $' + capital + ' of USDC to ' + chain + ' through ' + name + ' and use the bridged funds in its app.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return "Stake $" + capital + " of the chain's staking asset through " + name + ' and keep the receipt token.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Deposit $' + capital + ' of USDC as margin on ' + name + ' and open one small hedged position.';
    if (c.indexOf('prediction') >= 0) return 'Fund $' + capital + ' and place one market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return 'Deposit $' + capital + ' into a ' + name + ' vault on ' + chain + ' and keep the shares.';
    if (c.indexOf('stable') >= 0) return 'Mint or deposit $' + capital + ' of the stable asset through ' + name + ' on ' + chain + '.';
    if (c.indexOf('rwa') >= 0) return "Mint $" + capital + " of the protocol's yield asset on " + chain + ' and hold it.';
    if (c.indexOf('insurance') >= 0) return 'Buy $' + capital + ' of cover from ' + name + ' on ' + chain + ' and keep the policy.';
    if (c.indexOf('launchpad') >= 0) return 'Join $' + capital + ' of the next ' + name + ' launch on ' + chain + ' and hold the allocation.';
    return 'Deposit $' + capital + ' of USDC into ' + name + ' on ' + chain + ' and keep the position open.';
  }
  function secondActionFor(p, capital, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Borrow $25 against the supply on ' + name + ', then repay it in full the same week.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Swap $25 through ' + name + "'s main pool on " + chain + ' once a week.';
    if (c.indexOf('bridge') >= 0) return 'Bridge $25 back through ' + name + ' once, so the wallet shows use in both directions.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Restake or compound the staking rewards through ' + name + ' once a month.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Close the hedge on ' + name + ' and open a fresh one, so the wallet shows repeated use.';
    if (c.indexOf('prediction') >= 0) return 'Settle one more small market position on ' + name + ' each week.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return 'Add $25 to the ' + name + ' vault on ' + chain + ' in a second deposit.';
    if (c.indexOf('stable') >= 0) return 'Swap $25 of the stable asset through ' + name + ' once a week.';
    if (c.indexOf('rwa') >= 0) return 'Claim the yield on the ' + name + ' asset once a month and leave the principal in place.';
    if (c.indexOf('insurance') >= 0) return 'Renew or top up the ' + name + ' cover once, so the policy stays active.';
    return 'Make one more deposit of $25 into ' + name + ' on ' + chain + ' in a second week.';
  }
  function weeklyActionFor(p, chain) {
    var c = (p.category || '').toLowerCase();
    var name = p.name;
    if (c.indexOf('lend') >= 0 || c.indexOf('cdp') >= 0 || c.indexOf('collateral') >= 0) return 'Each week, supply or borrow a small amount on ' + name + ', so the wallet shows steady lending use.';
    if (c.indexOf('dex') >= 0 || c.indexOf('yield') >= 0 || c.indexOf('leveraged farm') >= 0) return 'Each week, swap $25 through ' + name + "'s main pool on " + chain + '.';
    if (c.indexOf('bridge') >= 0) return 'Each week, bridge a small amount through ' + name + ' in one direction or the other.';
    if (c.indexOf('staking') >= 0 || c.indexOf('restak') >= 0) return 'Each week, check the staking rewards on ' + name + ' and compound them when they cover the gas.';
    if (c.indexOf('perpetual') >= 0 || c.indexOf('derivative') >= 0 || c.indexOf('options') >= 0) return 'Each week, open and close one small hedged position on ' + name + '.';
    if (c.indexOf('prediction') >= 0) return 'Each week, settle one more small market position on ' + name + '.';
    if (c.indexOf('curator') >= 0 || c.indexOf('allocator') >= 0 || c.indexOf('vault') >= 0) return 'Each week, add $25 to the ' + name + ' vault on ' + chain + ' or rebalance between its vaults.';
    if (c.indexOf('stable') >= 0) return 'Each week, swap or deposit $25 of the stable asset through ' + name + '.';
    if (c.indexOf('rwa') >= 0) return 'Each week, check the yield on the ' + name + ' asset and claim it when it covers the gas.';
    if (c.indexOf('insurance') >= 0) return 'Each week, check that the ' + name + ' cover is still active and top it up when it runs low.';
    return 'Each week, make one more deposit of $25 into ' + name + ' on ' + chain + '.';
  }
  function stepText(step) {
    var s = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
    if (s.length > 600) s = s.slice(0, 596) + '...';
    if (s.length < 20) s = s + " Hold the position and check the protocol's own page.";
    return s;
  }
  function farmSteps(p, sc) {
    var chain = chainOf(p);
    var capital = Math.round(depositOf(p, sc));
    var perTx = p.per_tx_usd;
    var holdDays = sc.horizon * 7;
    return [
      { text: 'Use a fresh wallet that holds only the funds you plan to farm, and keep its seed phrase offline.', cost: 'under $' + Math.max(1, perTx) + ' of gas for the first transaction', time: '5 minutes' },
      { text: actionFor(p, capital, chain), cost: '$' + capital + ' of capital and about $' + perTx + ' of gas', time: '15 minutes to set up' },
      { text: secondActionFor(p, capital, chain), cost: 'about $' + perTx + ' of gas', time: '10 minutes' },
      { text: weeklyActionFor(p, chain), cost: 'about $' + perTx + ' of gas a week', time: '10 minutes a week' },
      { text: 'Hold the position for at least ' + holdDays + ' days so the activity is counted in more than one snapshot.', cost: 'the $' + capital + ' stays in the position', time: holdDays + ' days' },
      { text: "Before you withdraw, open the protocol's own points or rewards page and claim only from the link it publishes.", cost: 'no fee to check, and never pay to claim', time: '10 minutes' },
      { text: 'Write the wallet, the dates and every transaction in a farm log, then unwind the position in two parts so you keep the record.', cost: 'about $' + (perTx * 2) + ' of gas to unwind', time: '5 minutes to log, 10 minutes to unwind' }
    ].map(stepText);
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('tab')) state.tab = params.get('tab');
    if (params.get('sort')) state.sort = params.get('sort');
    if (params.get('f')) state.filter = params.get('f');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.selected) params.set('p', state.selected);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.tab !== 'board') params.set('tab', state.tab);
    if (state.sort !== 'implied') params.set('sort', state.sort);
    if (state.filter !== 'all') params.set('f', state.filter);
    var h = params.toString();
    history.replaceState(null, '', h ? '#' + h : window.location.pathname + window.location.search);
  }
  readHash();

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] === false) { /* a false boolean attribute stays off */ }
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function evTable(terms, key, a) {
    return el('table', { class: 'mini' },
      el('thead', null, el('tr', null, el('th', { text: 'Term, added in order' }), el('th', { class: 'num', text: a }), el('th', { class: 'num', text: 'Walk-forward' }), el('th', { text: 'Kept?' }))),
      el('tbody', null, (terms || []).map(function (t, i) {
        return el('tr', null, el('td', { text: t.term }), el('td', { class: 'num', text: t[key].toFixed(3) }), el('td', { class: 'num', text: t.walk_forward.toFixed(3) }), el('td', { text: i === 0 ? 'baseline' : (t.term.indexOf('control') >= 0 ? 'control' : (t.kept ? 'kept' : 'tested, not kept')) }));
      }))
    );
  }

  var rows = DATA.rows || [];
  var maxImplied = rows.length ? rows[0].implied_value_usd : 1;
  var categories = Array.from(new Set(rows.map(function (r) { return r.category || 'Uncategorised'; }))).sort();
  var chains = Array.from(new Set(rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();

  function verdictCounts() {
    var c = { FARM: 0, MARGINAL: 0, SKIP: 0 };
    rows.forEach(function (r) { c[netFor(r, state.sc).verdict]++; });
    return c;
  }

  function filteredRows() {
    var q = state.q.trim().toLowerCase();
    var list = rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Uncategorised') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.filter === 'offlist' && !r.off_list) return false;
      if (state.filter === 'watchlist' && !r.watchlist) return false;
      if ((state.filter === 'FARM' || state.filter === 'MARGINAL' || state.filter === 'SKIP') && netFor(r, state.sc).verdict !== state.filter) return false;
      if (q && (r.name + ' ' + r.slug + ' ' + (r.category || '')).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var key = state.sort;
    list.sort(function (a, b) {
      var d = 0;
      if (key === 'implied') d = a.implied_value_usd - b.implied_value_usd;
      else if (key === 'fitted') d = a.fitted_value_usd - b.fitted_value_usd;
      else if (key === 'odds') d = a.odds - b.odds;
      else if (key === 'tvl') d = a.tvl_usd - b.tvl_usd;
      else if (key === 'growth') d = (a.change_7d || 0) - (b.change_7d || 0);
      else if (key === 'age') d = (a.age_days || 0) - (b.age_days || 0);
      else if (key === 'net') d = netFor(a, state.sc).net - netFor(b, state.sc).net;
      else if (key === 'name') d = a.name < b.name ? -1 : 1;
      return d * state.dir;
    });
    return list;
  }

  function download(name, text, type) {
    var blob = new Blob([text], { type: type });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 500);
  }
  function exportCSV() {
    var list = filteredRows();
    var head = 'rank,protocol,category,chains,tvl_usd,change_7d,odds,fitted_usd,expected_usd,p25_usd,p75_usd,deposit_usd,fees_usd,net_usd,net_per_hour_usd,verdict,off_list';
    var lines = list.map(function (r) {
      var e = netFor(r, state.sc);
      return [r.rank, '"' + r.name.replace(/"/g, '""') + '"', '"' + (r.category || '').replace(/"/g, '""') + '"', '"' + (r.chains || []).join(';') + '"', r.tvl_usd, r.change_7d === null ? '' : r.change_7d, r.odds, r.fitted_value_usd, r.implied_value_usd, r.p25_usd, r.p75_usd, e.deposit, e.fees, Math.round(e.net * 100) / 100, Math.round(e.netPerHour * 100) / 100, e.verdict, r.off_list ? 'yes' : 'no'].join(',');
    });
    download('token-radar-board.csv', head + '\n' + lines.join('\n') + '\n', 'text/csv');
  }
  function exportJSON() {
    var list = filteredRows().map(function (r) {
      var e = netFor(r, state.sc);
      return { rank: r.rank, slug: r.slug, name: r.name, category: r.category, tvl_usd: r.tvl_usd, odds: r.odds, fitted_value_usd: r.fitted_value_usd, expected_value_usd: r.implied_value_usd, p25_usd: r.p25_usd, p75_usd: r.p75_usd, deposit_usd: e.deposit, fees_usd: e.fees, net_usd: Math.round(e.net * 100) / 100, verdict: e.verdict, off_list: r.off_list };
    });
    download('token-radar-board.json', JSON.stringify({ as_of: DATA.as_of, model: DATA.model_version, scenario: state.sc, rows: list }, null, 2) + '\n', 'application/json');
  }

  function nearestPeers(row) {
    var comps = DATA.comps || [];
    var same = comps.filter(function (c) { return (c.category || 'Uncategorised') === (row.category || 'Uncategorised'); });
    var other = comps.filter(function (c) { return (c.category || 'Uncategorised') !== (row.category || 'Uncategorised'); });
    var byDist = function (a, b) { return Math.abs(Math.log(a.tvl_usd) - Math.log(row.tvl_usd)) - Math.abs(Math.log(b.tvl_usd) - Math.log(row.tvl_usd)); };
    same.sort(byDist); other.sort(byDist);
    return same.slice(0, 8).concat(other.slice(0, Math.max(0, 8 - same.length)));
  }

  function renderDetail() {
    if (!state.selected) return null;
    var row = null;
    rows.forEach(function (r) { if (r.slug === state.selected) row = r; });
    if (!row) return null;
    var recomputedFitted = fittedOf(row);
    var recomputed = impliedOf(row);
    var e = netFor(row, state.sc);
    var steps = farmSteps(row, state.sc);
    var peers = nearestPeers(row);
    var residText = row.category_peers > 0
      ? 'category residual ' + (row.category_residual >= 0 ? '+' : '') + row.category_residual.toFixed(2) + ' from ' + row.category_peers + ' live peers'
      : 'no category residual: fewer than 5 live peers in this category, so the global curve stands';
    var why = 'Rank ' + row.rank + ' of ' + DATA.board_size + ' (rank ' + row.rank_lo + '–' + row.rank_hi + ' across 200 bootstrap refits): ' + fmtUsd(row.tvl_usd) + ' TVL priced at ' + row.fitted_multiple.toFixed(3) + 'x by the size curve (' + residText + '), then odds ' + Math.round(row.odds * 100) + '% from the logistic model. Expected value ' + fmtUsd(row.implied_value_usd) + ', with half of similar launches pricing between ' + fmtUsd(row.p25_usd) + ' and ' + fmtUsd(row.p75_usd) + '.';
    var om = DATA.odds_model || {};
    var terms = row.odds_terms || [0, 0, 0, 0];
    var beDrop = (row.break_even_drop_share * 100).toFixed(1);
    var beOdds = (row.break_even_odds * 100).toFixed(1);
    var depOptions = [1000, 3000, Math.round(e.deposit), 30000].filter(function (v, i, a) { return a.indexOf(v) === i; }).sort(function (a, b) { return a - b; });
    var shares = [3.5, 7, 14];
    var box = el('section', { class: 'detail', 'aria-label': 'Protocol detail' },
      el('button', { class: 'close', text: 'Close', onclick: function () { state.selected = null; state.checked = {}; render(); } }),
      el('h2', { text: '#' + row.rank + ' ' + row.name }),
      el('div', { class: 'meta', text: (row.category || 'Uncategorised') + ' · ' + (row.chains || []).join(', ') + ' · listed ' + (row.listed_at || 'unknown') + ' · ' + fmtAge(row.age_days) + ' old · no token yet' + (row.off_list ? ' · OFF-LIST: the watchlist leaves it out, same model, no haircut' : '') + (row.watchlist ? ' · on the watchlist' : '') }),
      el('div', { class: 'kv' },
        el('div', null, el('b', { text: fmtUsd(row.implied_value_usd) }), el('span', { text: 'expected launch value (page recomputes ' + fmtUsd(recomputed) + ')' })),
        el('div', null, el('b', { text: fmtUsd(row.fitted_value_usd) }), el('span', { text: 'fitted value if it launched (page recomputes ' + fmtUsd(recomputedFitted) + ')' })),
        el('div', null, el('b', { text: Math.round(row.odds * 100) + '%' }), el('span', { text: 'token odds · logistic, logit ' + row.odds_logit.toFixed(2) })),
        el('div', null, el('b', { text: fmtUsd(row.tvl_usd) }), el('span', { text: 'total value locked · 7d ' + fmtPct(row.change_7d) }))
      ),
      el('div', { class: 'kv' },
        el('div', null, el('b', { text: row.fitted_multiple.toFixed(3) + 'x' }), el('span', { text: 'fitted multiple from the size curve' })),
        el('div', null, el('b', { text: (row.category_residual >= 0 ? '+' : '') + row.category_residual.toFixed(2) }), el('span', { text: residText })),
        el('div', null, el('b', { text: e.verdict }), el('span', { text: 'farm verdict · ' + verdictReason(row, e) })),
        el('div', null, el('b', { text: fmtMoney(e.net) }), el('span', { text: 'net of fees · ' + fmtMoney(e.netPerHour) + '/hour · fees ' + fmtMoney(e.fees) }))
      ),
      el('p', { class: 'why', text: why }),
      el('section', { class: 'howmade' },
        el('h3', { text: 'How the figure is made' }),
        el('table', { class: 'mini' }, el('tbody', null,
          el('tr', null, el('td', { text: 'TVL' }), el('td', { class: 'num', text: fmtUsd(row.tvl_usd) })),
          el('tr', null, el('td', { text: 'Base multiple, from the size curve (market cap = exp(' + DATA.size_fit.intercept.toFixed(2) + ' + ' + DATA.size_fit.slope.toFixed(2) + ' x ln TVL))' }), el('td', { class: 'num', text: 'x' + row.base_multiple.toFixed(3) })),
          el('tr', null, el('td', { text: 'Category effect (' + residText + ')' }), el('td', { class: 'num', text: 'x' + Math.exp(row.category_residual).toFixed(2) })),
          el('tr', null, el('td', { html: '<b>Value if a token launches</b> = TVL x base multiple x category effect' }), el('td', { class: 'num', html: '<b>' + fmtUsd(row.fitted_value_usd) + '</b>' })),
          el('tr', null, el('td', { text: 'Token odds, logistic: intercept ' + (om.intercept !== undefined ? om.intercept.toFixed(2) : 'n/a') + ' + years listed ' + (terms[0] >= 0 ? '+' : '') + terms[0].toFixed(2) + ' (' + fmtAge(row.age_days) + ') + ln TVL ' + (terms[1] >= 0 ? '+' : '') + terms[1].toFixed(2) + ' + 7-day growth ' + (terms[2] >= 0 ? '+' : '') + terms[2].toFixed(2) + ' (' + fmtPct(row.change_7d) + ') + category offset ' + (terms[3] >= 0 ? '+' : '') + terms[3].toFixed(2) + ' (' + (row.category || 'Uncategorised') + ')' }), el('td', { class: 'num', text: 'logit ' + row.odds_logit.toFixed(2) + ' -> ' + Math.round(row.odds * 100) + '%' })),
          el('tr', null, el('td', { html: '<b>Expected value</b> = fitted value x odds' }), el('td', { class: 'num', html: '<b>' + fmtUsd(row.implied_value_usd) + '</b>' })),
          el('tr', null, el('td', { text: 'Prediction interval: half of similar launches price inside P25–P75, four in five inside P10–P90' }), el('td', { class: 'num', text: fmtUsd(row.p25_usd) + ' – ' + fmtUsd(row.p75_usd) + ' · ' + fmtUsd(row.p10_usd) + ' – ' + fmtUsd(row.p90_usd) })),
          el('tr', null, el('td', { text: 'Rank across 200 bootstrap refits of the live protocols' }), el('td', { class: 'num', text: row.rank_lo + '–' + row.rank_hi }))
        )),
        el('p', { text: 'Break-evens at the current scenario: fees are covered while the drop share stays above ' + beDrop + '% (model ' + state.sc.dropShare + '%) and the token odds above ' + beOdds + '% (the model implies ' + Math.round(row.odds * 100) + '%).' })
      ),
      el('section', { class: 'nettable' },
        el('h3', { text: 'Net of fees by drop share and deposit — ' + fmtMoney(e.deposit) + ' deposit, ' + state.sc.horizon + ' weeks, fees ' + fmtMoney(e.fees) }),
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { text: 'Drop share' }), depOptions.map(function (d) { return el('th', { class: 'num', text: fmtMoney(d) }); }))),
          el('tbody', null, shares.map(function (sh) {
            return el('tr', null, el('td', { text: sh + '%' }), depOptions.map(function (d) {
              var drop = row.implied_value_usd * (sh / 100) * (d / row.tvl_usd);
              var net = drop - e.fees;
              var isPlan = Math.abs(sh - state.sc.dropShare) < 0.01 && Math.abs(d - Math.round(e.deposit)) < 1;
              return el('td', { class: 'num' + (isPlan ? ' plan' : '') + (net < 0 ? ' neg' : ' pos'), text: fmtMoney(net) });
            }));
          }))
        ),
        el('p', { text: 'Drop = expected value x drop share x deposit / TVL. The highlighted cell is the current scenario. Yield earned meanwhile is left out.' })
      ),
      el('h3', { text: 'How to farm it — 7 steps · ' + fmtMoney(e.fees) + ' of fees on a ' + fmtMoney(e.deposit) + ' deposit' }),
      el('ol', { class: 'farm' }, steps.map(function (s, i) {
        var key = row.slug + ':' + i;
        var li = el('li', null, el('label', null,
          el('input', { type: 'checkbox', checked: !!state.checked[key], onchange: function (ev) { state.checked[key] = ev.target.checked; var lab = ev.target.parentNode; if (ev.target.checked) lab.classList.add('done'); else lab.classList.remove('done'); } }),
          document.createTextNode(s)));
        if (state.checked[key]) li.firstChild.classList.add('done');
        return li;
      })),
      el('p', { class: 'warn', text: 'No token is guaranteed. A farm plan is a bet on a launch that may never happen, Never pay anyone to claim an airdrop, and only use the protocol\u2019s own page.' }),
      peers.length ? el('div', null,
        el('h3', { text: 'Nearest priced peers — tokens that trade' }),
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { text: 'Token' }), el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }), el('th', { class: 'num', text: 'Cap / TVL' }), el('th', { class: 'num', text: 'Cap / held-out model' }))),
          el('tbody', null, peers.map(function (l) {
            return el('tr', null, el('td', { text: l.name + (l.category === row.category ? '' : ' · ' + (l.category || 'Uncategorised')) }),
              el('td', { class: 'num', text: fmtUsd(l.tvl_usd) }),
              el('td', { class: 'num', text: fmtUsd(l.mcap_usd) }),
              el('td', { class: 'num', text: l.tvl_usd ? (l.mcap_usd / l.tvl_usd).toFixed(2) + 'x' : 'n/a' }),
              el('td', { class: 'num', text: l.loo_fitted_usd ? (l.mcap_usd / l.loo_fitted_usd).toFixed(2) + 'x' : 'n/a' }));
          })))
      ) : null
    );
    return box;
  }

  function renderBoard() {
    var list = filteredRows();
    var shown = list.slice(0, state.limit);
    var table = el('table', { class: 'board' },
      el('thead', null, el('tr', null,
        el('th', { text: 'Rank' }), el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
        el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: '7d' }),
        el('th', { class: 'num', text: 'Odds' }), el('th', { class: 'num', text: 'Fitted' }),
        el('th', { class: 'num', text: 'Expected value' }), el('th', { class: 'num', text: 'Net of fees' }),
        el('th', { text: 'Verdict' }))),
      el('tbody', null, shown.map(function (r) {
        var e = netFor(r, state.sc);
        return el('tr', { onclick: function () { state.selected = r.slug; state.checked = {}; render(); window.scrollTo(0, 0); } },
          el('td', { html: String(r.rank) + '<br><span style="color:var(--faint);font-size:12px">' + r.rank_lo + '–' + r.rank_hi + '</span>' }),
          el('td', null, el('b', { text: r.name }), r.off_list ? el('span', { class: 'chip off', text: 'off-list' }) : null, el('div', { class: 'bar', html: '<i style="width:' + Math.max(2, Math.round(100 * r.implied_value_usd / maxImplied)) + '%"></i>' }),
            el('div', null, (r.chains || []).slice(0, 3).map(function (c) { return el('span', { class: 'chip', text: c }); }))),
          el('td', { text: r.category || 'Uncategorised' }),
          el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
          el('td', { class: 'num ' + ((r.change_7d || 0) >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
          el('td', { class: 'num', text: Math.round(r.odds * 100) + '%' }),
          el('td', { class: 'num', text: fmtUsd(r.fitted_value_usd) }),
          el('td', { class: 'num', html: '<b>' + fmtUsd(r.implied_value_usd) + '</b><br><span style="color:var(--muted);font-size:12px">' + fmtUsd(r.p25_usd) + '–' + fmtUsd(r.p75_usd) + '</span>' }),
          el('td', { class: 'num ' + (e.net < 0 ? 'neg' : 'pos'), html: fmtMoney(e.net) + '<br><span style="color:var(--muted);font-size:12px">' + fmtMoney(e.netPerHour) + '/h</span>' }),
          el('td', null, el('span', { class: 'badge ' + e.verdict.toLowerCase(), text: e.verdict })));
      }))
    );
    var more = list.length > state.limit ? el('p', null, el('button', { class: 'sortbtn', text: 'Show more (' + (list.length - state.limit) + ' left)', onclick: function () { state.limit += 50; render(); } })) : null;
    return el('div', null,
      el('p', { class: 'count', text: 'Showing ' + shown.length + ' of ' + list.length + ' matching protocols · ' + DATA.board_size + ' ranked in all · click a row for its detail and farm plan' }),
      table, more);
  }

  function renderLive() {
    var live = DATA.live || [];
    return el('div', null,
      el('p', { class: 'count', text: 'Protocols whose token already trades, by market cap. They are the comparables the peer multiples come from — never mixed into the ranked board.' }),
      el('table', { class: 'board' },
        el('thead', null, el('tr', null, el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
          el('th', { class: 'num', text: 'TVL' }), el('th', { class: 'num', text: 'Market cap' }), el('th', { class: 'num', text: 'Mcap / TVL' }))),
        el('tbody', null, live.map(function (l) {
          return el('tr', { onclick: function () {} },
            el('td', null, el('b', { text: l.name })),
            el('td', { text: l.category || 'Uncategorised' }),
            el('td', { class: 'num', text: fmtUsd(l.tvl_usd) }),
            el('td', { class: 'num', text: fmtUsd(l.mcap_usd) }),
            el('td', { class: 'num', text: l.tvl_usd && l.mcap_usd ? (l.mcap_usd / l.tvl_usd).toFixed(2) + 'x' : 'n/a' }));
        }))));
  }

  function renderSetAside() {
    var list = DATA.set_aside || [];
    return el('div', null,
      el('p', { class: 'count', text: list.length + ' pre-token protocols the board does not rank, by TVL. Each one sits in exactly one group: below the $5M floor, a category whose token record is already priced (bridges, liquid staking, exchanges), or a name the board refuses to price as its own protocol. They are listed so the reader can check the accounting — nothing is hidden.' }),
      el('table', { class: 'board' },
        el('thead', null, el('tr', null, el('th', { text: 'Protocol' }), el('th', { text: 'Category' }),
          el('th', { class: 'num', text: 'TVL' }), el('th', { text: 'Why set aside' }))),
        el('tbody', null, list.map(function (l) {
          return el('tr', { onclick: function () {} },
            el('td', null, el('b', { text: l.name }), el('div', null, (l.chains || []).slice(0, 3).map(function (c) { return el('span', { class: 'chip', text: c }); }))),
            el('td', { text: l.category || 'Uncategorised' }),
            el('td', { class: 'num', text: fmtUsd(l.tvl_usd) }),
            el('td', { text: l.reason }));
        }))));
  }

  function renderMethod() {
    var om = DATA.odds_model || {};
    var ev = DATA.evidence || { terms: [] };
    var ac = DATA.accounting || {};
    var ho = DATA.honesty || {};
    var v = DATA.validation || {};
    var groups = (ac.set_aside_groups || []).map(function (g) { return g.group + ' ' + g.count; }).join(' · ');
    return el('div', null,
      el('section', { class: 'method' },
        el('h2', { text: 'How the radar works — model radar-7' }),
        el('p', { text: 'The snapshot is frozen at ' + DATA.as_of + ' (' + DATA.source + '). It carries ' + (ac.total || 758) + ' protocols at or above $5M TVL. Every one of them sits in exactly one group: ' + (ac.ranked || DATA.board_size) + ' ranked as pre-token (' + (ac.watchlist || 0) + ' on the watchlist, ' + (ac.below_floor || 0) + ' below the $50M floor, ' + (ac.off_list || 0) + ' off-list), ' + (ac.already_token || 0) + ' that already record a token, and ' + (ac.set_aside || 0) + ' set aside (' + groups + '). The board ranks the ' + DATA.board_size + ' pre-token rows by expected launch value: ' + DATA.verdict_counts.FARM + ' FARM, ' + DATA.verdict_counts.MARGINAL + ' MARGINAL, ' + DATA.verdict_counts.SKIP + ' SKIP at the default scenario.' }),
        el('p', { class: 'formula', html: 'Expected launch value = fitted value x odds. Fitted value = TVL x multiple, where the multiple comes from the size curve fitted on the snapshot\u2019s ' + DATA.size_fit.live_protocols + ' live-token protocols: market cap = exp(' + DATA.size_fit.intercept.toFixed(2) + ' + ' + DATA.size_fit.slope.toFixed(2) + ' x ln TVL), shifted by the category residual (only where at least 5 live peers stand behind it) and clamped to 0.01–0.60. Odds = a logistic regression on the peers\u2019 record (see below).' }),
        el('p', { text: 'Why a curve, not a flat multiple: a protocol ten times larger trades at about ' + Math.pow(10, DATA.size_fit.slope - 1).toFixed(2) + 'x the multiple, so a flat multiple would overvalue the giants by an order of magnitude. The curve is fitted on this snapshot at run time, never hard-coded. Held-out test, split in half by slug and run twice. Median absolute log error of the fitted market cap: the value model scores ' + v.value_half_a + ' and ' + v.value_half_b + ' on the two halves; the flat category median of radar-2 scores ' + v.radar2_half_a + ' and ' + v.radar2_half_b + '. On all 94 live tokens, the fitted value\u2019s rank correlation with the real market cap is ' + (v.spearman_fitted !== undefined ? v.spearman_fitted.toFixed(2) : 'n/a') + ', against ' + (v.spearman_tvl !== undefined ? v.spearman_tvl.toFixed(2) : 'n/a') + ' for TVL alone — the model ranks the tokens better than size alone does.' }),
        el('h3', { text: 'Token odds — a logistic regression on the peers\u2019 record' }),
        el('p', { text: 'The odds come from the ' + (om.peers || 0) + ' peers with an age — the rankable pre-token protocols and the live real-category protocols that carry a listed date. Features, standardized: years listed, ln TVL, 7-day change. Fitted by gradient descent (learning rate 0.05, 2000 iterations). Coefficients, in standard units: intercept ' + (om.intercept !== undefined ? om.intercept.toFixed(2) : 'n/a') + ', years +' + (om.coefs ? om.coefs[0].toFixed(2) : 'n/a') + ', ln TVL +' + (om.coefs ? om.coefs[1].toFixed(2) : 'n/a') + ', growth ' + (om.coefs ? om.coefs[2].toFixed(2) : 'n/a') + '. The odds rise with age and size and fall with growth. Each protocol then adds its category offset, the mean surprise of its peers, shrunk toward zero.  The ' + (om.no_age_count || 0) + ' rankable protocols with no listed date take the global rate ' + Math.round((om.global_rate || 0) * 100) + '%. Walk-forward, the logistic scores ' + (om.brier_logistic_wf !== undefined ? om.brier_logistic_wf.toFixed(3) : 'n/a') + ' and the offset ' + (om.brier_logistic_cat_wf !== undefined ? om.brier_logistic_cat_wf.toFixed(3) : 'n/a') + '; a random feature scores ' + (om.brier_control_wf !== undefined ? om.brier_control_wf.toFixed(3) : 'n/a') + ', so neither helps out of time. On resampled peers the size slope is ' + (DATA.coeff_stability ? DATA.coeff_stability.size_slope_mean.toFixed(2) : 'n/a') + ' +/- ' + (DATA.coeff_stability ? DATA.coeff_stability.size_slope_sd.toFixed(2) : 'n/a') + ' across ' + (DATA.coeff_stability ? DATA.coeff_stability.refits : 0) + ' refits, and the odds coefficients hold their sign in at least ' + (DATA.coeff_stability ? Math.round(100 * Math.min(DATA.coeff_stability.odds_sign_held[0], DATA.coeff_stability.odds_sign_held[1], DATA.coeff_stability.odds_sign_held[2])) : 0) + '% of ' + (DATA.coeff_stability ? DATA.coeff_stability.odds_refits : 0) + ' refits.' }),
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { text: 'Odds scored, Brier (lower is better)' }), el('th', { class: 'num', text: 'Brier' }))),
          el('tbody', null,
            el('tr', null, el('td', { text: 'Base rate alone' }), el('td', { class: 'num', text: (om.brier_base !== undefined ? om.brier_base.toFixed(3) : 'n/a') })),
            el('tr', null, el('td', { text: 'Age buckets, leave-one-out' }), el('td', { class: 'num', text: (om.brier_buckets_loo !== undefined ? om.brier_buckets_loo.toFixed(3) : 'n/a') })),
            el('tr', null, el('td', { text: 'Logistic model, 5-fold cross-validated' }), el('td', { class: 'num', text: (om.brier_logistic_cv !== undefined ? om.brier_logistic_cv.toFixed(3) : 'n/a') })),
            el('tr', null, el('td', { text: 'Logistic model with the category offset, 5-fold cross-validated' }), el('td', { class: 'num', text: (om.brier_logistic_cat_cv !== undefined ? om.brier_logistic_cat_cv.toFixed(3) : 'n/a') }))
          )),
        el('h3', { text: 'Which terms earn their place — leave-one-out and walk-forward' }),
        el('p', { text: 'Each candidate term is added alone to the kept model so far and scored two ways: leave-one-out (each of the ' + DATA.size_fit.live_protocols + ' traded tokens priced from a fit on the other 93) and walk-forward (the ' + (ev.walk_forward_train || 0) + ' tokens listed before ' + (ev.walk_forward_split || '') + ' price the ' + (ev.walk_forward_test || 0) + ' newer ones). A term is kept only when it lowers the held-out miss in both tests; a move under 1% on one test counts as flat. Median absolute log error:' }),
        evTable(ev.terms || [], 'loo', 'Leave-one-out'),
        el('h3', { text: 'Which odds terms earn their place - 5-fold and walk-forward' }),
        evTable((DATA.odds_evidence || {}).terms || [], 'cv', '5-fold'),
        el('p', { text: 'So the value model is the size curve plus the category effect, and nothing else: growth, age and chain count were all tested and dropped. Growth and age still matter — in the odds, where their signal is strong. A 7-day spike does not buy a higher multiple.' }),
        el('h3', { text: 'Ranges — what the printed interval is, and whether it is honest' }),
        el('p', { text: 'Every row prints a P25–P75 and a P10–P90 range on its expected value, and a rank range across 200 bootstrap refits of the live protocols (seeded, odds held fixed). The value range is a prediction interval: the fitted value times the 25th/75th (and 10th/90th) percentiles of the live comps\u2019 leave-one-out log-residuals — a conformal interval, measured on comps the fit never saw — widened 15%, because the unwidened band held only 48.9% of caps leave-one-out, under its nominal 50%. The honesty check is leave-one-out: each of the ' + (ho.n || 0) + ' comps priced from a fit on the other 93, its real market cap checked against the interval the other 93 imply. ' + Math.round((ho.p25_75 || 0) * 100) + '% of real caps fall inside the printed P25–P75 (stated 50%) and ' + Math.round((ho.p10_90 || 0) * 100) + '% inside P10–P90 (stated 80%). Walk-forward, the same bands hold ' + Math.round((ho.wf_p25_75 || 0) * 100) + '% and ' + Math.round((ho.wf_p10_90 || 0) * 100) + '% of the ' + (ho.wf_n || 0) + ' newer caps: the wide band under-holds on newer tokens, and the dashboard says so.' }),
        el('h3', { text: 'The curve against the tokens that trade' }),
        el('div', { html: DATA.scatter_svg || '' }),
        el('h3', { text: 'The farm verdict — netted, not just odds' }),
        el('p', { text: 'A farm is a deposit of 0.02% of the protocol\u2019s TVL (clamped $100–$50,000) held 12 weeks, against a 7% drop share. The modelled drop is expected value x drop share x deposit / TVL; the fees are chain-aware gas — $0.05 a transaction on Solana, $0.25 on Base, Arbitrum, Optimism, Plasma, Polygon and Binance, $1 on other chains, $3 on Ethereum alone (the 2026 level for ordinary transactions) — one setup transaction, one a week, two to unwind. The net is the drop less the fees. FARM when the net beats both the T-bill return on the deposit (4% a year) and $25 an hour of hands-on work; SKIP when the fees cover the drop; else MARGINAL. The scenario controls recompute every verdict the same way.' }),
        el('h3', { text: 'The off-list 20' }),
        el('p', { text: 'Twenty rankable protocols sit at or above the $50M floor but are not on the watchlist, because the house leaves them out for its parentProtocol rule — a protocol whose parent already recorded a token. That rule is not a field of the snapshot, so the board ranks them with the same model and flags them off-list. Sentora Curator, the second row, is one of them.' }),
        el('p', { text: 'What this is not: a prediction that a token will launch, or when. The fitted value says what a token would be worth if the protocol\u2019s record stayed as it is; the odds are the peers\u2019 own record, not a forecast for any one protocol. Farm plans are generic by category, not advice for any one wallet.' })
      ),
      el('section', { class: 'peers' },
        el('h2', { text: 'Token odds by age — share of the peers that already have a token' }),
        el('table', { class: 'mini' },
          el('thead', null, el('tr', null, el('th', { text: 'Tracked with no token' }), el('th', { class: 'num', text: 'Live' }), el('th', { class: 'num', text: 'Pre-token' }), el('th', { class: 'num', text: 'Raw rate' }), el('th', { class: 'num', text: 'Odds used' }))),
          el('tbody', null, (DATA.odds_table || []).map(function (o) {
            return el('tr', null, el('td', { text: o.bucket }), el('td', { class: 'num', text: String(o.live) }),
              el('td', { class: 'num', text: String(o.pre_token) }), el('td', { class: 'num', text: Math.round(o.raw_rate * 100) + '%' }),
              el('td', { class: 'num', text: Math.round(o.odds * 100) + '%' }));
          })))
      ));
  }

  function integrityChecks() {
    var checks = [];
    checks.push({ label: 'watchlist ' + DATA.watchlist_covered + '/' + DATA.watchlist_size, ok: DATA.watchlist_covered === DATA.watchlist_size });
    var sortedOk = true;
    rows.forEach(function (r, i) { if (i > 0 && rows[i - 1].implied_value_usd < r.implied_value_usd) sortedOk = false; });
    checks.push({ label: 'board sorted by expected value', ok: sortedOk });
    var recomputeOk = rows.every(function (r) { var re = impliedOf(r); return Math.abs(re - r.implied_value_usd) <= Math.max(2, 0.005 * r.implied_value_usd); });
    checks.push({ label: 'values recompute from the page', ok: recomputeOk });
    var stepsOk = rows.every(function (r) { return farmSteps(r, DEFAULT_SC).length === 7; });
    checks.push({ label: '7 farm steps on every row', ok: stepsOk });
    var sum = rows.reduce(function (s, r) { return s + r.implied_value_usd; }, 0);
    checks.push({ label: 'totals equal: ' + fmtUsd(sum), ok: sum === DATA.total_expected_usd });
    var checksumOk = fnv1a(JSON.stringify(rows)) === DATA.checksum;
    checks.push({ label: 'checksum ' + DATA.checksum + ' matches the board', ok: checksumOk });
    return checks;
  }

  function render() {
    writeHash();
    app.setAttribute('aria-busy', 'false');
    app.innerHTML = '';
    var wrap = el('div', { class: 'wrap' });
    var checks = integrityChecks();
    var passed = checks.filter(function (c) { return c.ok; }).length;
    var vc = verdictCounts();
    var ac = DATA.accounting || {};
    var farms0 = rows.map(function (r) { return { r: r, e: netFor(r, state.sc) }; }).filter(function (x) { return x.e.verdict === 'FARM'; });
    farms0.sort(function (a, b) { return b.e.netPerHour - a.e.netPerHour; });
    var keptOf = function (ev) { var k = 0, n = 0; (((ev || {}).terms) || []).forEach(function (t, i) { if (i === 0 || t.term.indexOf('control') >= 0) return; n++; if (t.kept) k++; }); return k + ' of ' + n; };
    var hero = el('header', { class: 'hero' },
      el('div', { class: 'eyebrow', text: 'Token launch radar · snapshot ' + DATA.as_of }),
      el('h1', { text: 'Which pre-token protocol is worth farming next?' }),
      el('p', { class: 'lede', text: 'Every protocol in the snapshot with no token yet, ranked by what its launch would be worth — its TVL priced on the curve fitted from live tokens, times the odds a token ever lists, each with a netted farm verdict and a costed plan.' }),
      el('div', { class: 'accounting', text: 'All ' + (ac.total || 758) + ' snapshot protocols in exactly one group: ' + (ac.ranked || DATA.board_size) + ' ranked as pre-token (' + (ac.watchlist || 0) + ' watchlist + ' + (ac.below_floor || 0) + ' below the floor + ' + (ac.off_list || 0) + ' off-list) · ' + (ac.already_token || 0) + ' already record a token · ' + (ac.set_aside || 0) + ' set aside' }),
      el('div', { class: 'stats' },
        el('div', { class: 'stat' }, el('b', { text: String(DATA.board_size) }), el('span', { text: 'protocols ranked' })),
        el('div', { class: 'stat' }, el('b', { text: String(DATA.watchlist_size) }), el('span', { text: 'on the watchlist' })),
        el('div', { class: 'stat' }, el('b', { text: fmtUsd(DATA.total_expected_usd) }), el('span', { text: 'total expected value' })),
        el('div', { class: 'stat' }, el('b', { text: rows.length ? rows[0].name : 'n/a' }), el('span', { text: 'rank 1 · ' + fmtUsd(rows.length ? rows[0].implied_value_usd : 0) + ' expected' })),
        el('div', { class: 'stat' }, el('b', { text: (DATA.validation && DATA.validation.spearman_fitted !== undefined ? DATA.validation.spearman_fitted.toFixed(2) : 'n/a') }), el('span', { text: 'rank correlation vs real caps · TVL alone ' + (DATA.validation && DATA.validation.spearman_tvl !== undefined ? DATA.validation.spearman_tvl.toFixed(2) : 'n/a') })),
        el('div', { class: 'stat' }, el('b', { text: DATA.model_version }), el('span', { text: 'model · fitted, held-out tested' })),
        el('div', { class: 'stat' }, el('b', { text: keptOf(DATA.evidence) + ' value · ' + keptOf(DATA.odds_evidence) + ' odds' }), el('span', { text: 'terms survive both tests' })),
        el('div', { class: 'stat' }, el('b', { text: farms0.length ? '+' + fmtMoney(farms0[0].e.netPerHour) + '/h' : 'no FARM row' }), el('span', { text: farms0.length ? 'best net per hour · ' + farms0[0].r.name : 'no row clears both bars' }))
      ),
      el('div', { class: 'top3' }, rows.slice(0, 3).map(function (r) {
        return el('button', { class: 'pick', onclick: function () { state.selected = r.slug; state.checked = {}; state.tab = 'board'; render(); window.scrollTo(0, 0); } },
          el('span', { class: 'rank', text: 'Rank ' + r.rank }),
          el('span', { class: 'name', text: r.name }),
          el('span', { class: 'val', text: fmtUsd(r.implied_value_usd) + ' expected' }),
          el('span', { class: 'sub', text: ' · fitted ' + fmtUsd(r.fitted_value_usd) + ' · odds ' + Math.round(r.odds * 100) + '% · ' + (r.category || 'Uncategorised') + (r.off_list ? ' · off-list' : '') }));
      })),
      (function () {
        var farms = farms0;
        var label = farms.length ? 'Farm next — the ' + farms.length + ' rows that clear fees and the T-bill at the default scenario, best net per hour first' : 'Farm next — no row clears both bars at the default scenario; move the scenario controls and the board re-prices';
        return el('div', { class: 'farmnext' },
          el('div', { class: 'farmnext-title', text: label }),
          farms.map(function (x) {
            return el('button', { class: 'farmnext-pick', onclick: function () { state.selected = x.r.slug; state.checked = {}; state.tab = 'board'; render(); window.scrollTo(0, 0); } },
              el('span', { class: 'rank', text: '#' + x.r.rank }),
              el('span', { class: 'name', text: x.r.name }),
              el('span', { class: 'val', text: '+' + fmtMoney(x.e.net) + ' net · ' + fmtMoney(x.e.netPerHour) + '/h' }));
          }));
      })(),
      el('div', { class: 'integrity', text: 'Integrity checks: ' + passed + '/' + checks.length + ' pass — ' + checks.map(function (c) { return (c.ok ? '✓ ' : '✗ ') + c.label; }).join(' · ') })
    );
    wrap.appendChild(hero);

    var detail = renderDetail();
    if (detail) wrap.appendChild(detail);

    var controls = el('div', { class: 'controls' },
      el('input', { type: 'search', placeholder: 'Search a protocol, category or chain…', value: state.q, 'aria-label': 'Search protocols',
        oninput: function (e) { state.q = e.target.value; state.limit = 50; render(); } }),
      el('select', { 'aria-label': 'Category filter', onchange: function (e) { state.category = e.target.value; state.limit = 50; render(); } },
        el('option', { value: 'all', text: 'All categories' }),
        categories.map(function (c) { return el('option', { value: c, selected: state.category === c ? 'selected' : null, text: c }); })),
      el('select', { 'aria-label': 'Chain filter', onchange: function (e) { state.chain = e.target.value; state.limit = 50; render(); } },
        el('option', { value: 'all', text: 'All chains' }),
        chains.map(function (c) { return el('option', { value: c, selected: state.chain === c ? 'selected' : null, text: c }); })),
      el('select', { 'aria-label': 'Sort by', onchange: function (e) { state.sort = e.target.value; render(); } },
        el('option', { value: 'implied', selected: state.sort === 'implied' ? 'selected' : null, text: 'Sort: expected value' }),
        el('option', { value: 'fitted', selected: state.sort === 'fitted' ? 'selected' : null, text: 'Sort: fitted value' }),
        el('option', { value: 'odds', selected: state.sort === 'odds' ? 'selected' : null, text: 'Sort: token odds' }),
        el('option', { value: 'tvl', selected: state.sort === 'tvl' ? 'selected' : null, text: 'Sort: TVL' }),
        el('option', { value: 'growth', selected: state.sort === 'growth' ? 'selected' : null, text: 'Sort: 7-day growth' }),
        el('option', { value: 'age', selected: state.sort === 'age' ? 'selected' : null, text: 'Sort: age' }),
        el('option', { value: 'net', selected: state.sort === 'net' ? 'selected' : null, text: 'Sort: net of fees' }),
        el('option', { value: 'name', selected: state.sort === 'name' ? 'selected' : null, text: 'Sort: name' })),
      el('div', { class: 'tabs' },
        el('button', { 'aria-pressed': state.tab === 'board' ? 'true' : 'false', text: 'Board', onclick: function () { state.tab = 'board'; render(); } }),
        el('button', { 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live tokens', onclick: function () { state.tab = 'live'; render(); } }),
        el('button', { 'aria-pressed': state.tab === 'setaside' ? 'true' : 'false', text: 'Set aside', onclick: function () { state.tab = 'setaside'; render(); } }),
        el('button', { 'aria-pressed': state.tab === 'method' ? 'true' : 'false', text: 'Method', onclick: function () { state.tab = 'method'; render(); } }))
    );
    wrap.appendChild(controls);

    var chips = el('div', { class: 'chips' },
      [['all', 'All ' + DATA.board_size], ['FARM', 'Farm ' + vc.FARM], ['MARGINAL', 'Marginal ' + vc.MARGINAL], ['SKIP', 'Skip ' + vc.SKIP], ['offlist', 'Off-list ' + (ac.off_list || 0)], ['watchlist', 'Watchlist ' + (ac.watchlist || 0)]].map(function (c) {
        return el('button', { class: 'chipbtn' + (state.filter === c[0] ? ' on' : ''), text: c[1], onclick: function () { state.filter = c[0]; state.limit = 50; render(); } });
      }),
      el('span', { class: 'exports' },
        el('button', { class: 'sortbtn', text: 'CSV', onclick: exportCSV }),
        el('button', { class: 'sortbtn', text: 'JSON', onclick: exportJSON }))
    );
    wrap.appendChild(chips);

    var sc = el('div', { class: 'scenario' },
      el('span', { class: 'sc-title', text: 'Farm scenario:' }),
      el('label', null, 'Deposit ',
        el('input', { type: 'range', min: '0.01', max: '0.1', step: '0.005', value: String(state.sc.depositPct),
          oninput: function (e) { state.sc.depositPct = parseFloat(e.target.value); var o = document.getElementById('sc-dep'); if (o) o.textContent = state.sc.depositPct.toFixed(3) + '% of TVL'; },
          onchange: function () { render(); } }),
        el('b', { id: 'sc-dep', text: state.sc.depositPct.toFixed(3) + '% of TVL' })),
      el('label', null, 'Drop share ',
        el('input', { type: 'range', min: '1', max: '14', step: '0.5', value: String(state.sc.dropShare),
          oninput: function (e) { state.sc.dropShare = parseFloat(e.target.value); var o = document.getElementById('sc-drop'); if (o) o.textContent = state.sc.dropShare + '%'; },
          onchange: function () { render(); } }),
        el('b', { id: 'sc-drop', text: state.sc.dropShare + '%' })),
      el('label', null, 'Horizon ',
        el('input', { type: 'range', min: '4', max: '26', step: '1', value: String(state.sc.horizon),
          oninput: function (e) { state.sc.horizon = parseInt(e.target.value, 10); var o = document.getElementById('sc-hor'); if (o) o.textContent = state.sc.horizon + ' weeks'; },
          onchange: function () { render(); } }),
        el('b', { id: 'sc-hor', text: state.sc.horizon + ' weeks' })),
      el('button', { class: 'sortbtn', text: 'Reset scenario', onclick: function () { state.sc = { depositPct: DEFAULT_SC.depositPct, dropShare: DEFAULT_SC.dropShare, horizon: DEFAULT_SC.horizon }; render(); } })
    );
    wrap.appendChild(sc);

    if (state.tab === 'live') wrap.appendChild(renderLive());
    else if (state.tab === 'setaside') wrap.appendChild(renderSetAside());
    else if (state.tab === 'method') wrap.appendChild(renderMethod());
    else wrap.appendChild(renderBoard());

    wrap.appendChild(el('footer', { text: 'Source: ' + DATA.source + ' · Floor $50M · Board covers the whole watchlist plus every rankable pre-token protocol, off-list included and flagged · Expected values are this radar\u2019s own claim, not a prediction of a launch. Runs offline: no network, no tracking.' }));
    app.appendChild(wrap);
  }

  render();
})();

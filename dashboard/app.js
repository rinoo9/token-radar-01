// Token Radar, radar-6 dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the ranked board, filters, a per-protocol detail drawer with the
// model's own inputs and the protocol's farm plan, and the methodology. No network:
// every byte it shows is in data.js. Farm steps come from data.js, so the page shows
// exactly the plan board.json carries; implied value is recomputed here from the same
// snapshot figures and checked against the board's number.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', watch: false, tab: 'pre-token', sort: 'implied', dir: -1, selected: null };
  var M = DATA.model;

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
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
  // The model in one function, in the same order and arithmetic as lib/model.ts:
  // peer ratio x size x momentum (absolute + relative) x maturity x chains x headroom
  // x dominance x confidence. The row carries the snapshot figures the recompute needs
  // (category median change, tokened share, category share); the stored multipliers
  // are display only and are never used here. Confidence is recomputed from the same
  // gaps the model sees: a missing 7d change or a missing age means an input was
  // guessed, and the row is discounted 0.97x for one missing input, 0.94x for both.
  function impliedOf(row) {
    var raw = row.change_7d === null || row.change_7d === undefined ? null : row.change_7d;
    var growth = raw === null ? 0 : Math.min(M.growth_cap, Math.max(M.growth_floor, raw));
    var rel = raw === null ? 0 : Math.min(M.rel_cap, Math.max(M.rel_floor, raw - row.cat_median_change));
    var momentum = 1 + (growth / 100) * M.momentum_abs_weight + (rel / 100) * M.momentum_rel_weight;
    var size = Math.min(M.size_max, Math.max(M.size_min, Math.pow(row.tvl_usd / M.size_ref_usd, -M.size_exponent)));
    var age = row.age_days === null || row.age_days === undefined ? M.unknown_age_days : row.age_days;
    var maturity = M.maturity_floor + M.maturity_range * Math.sqrt(Math.min(Math.max(age, 0), M.maturity_days) / M.maturity_days);
    var chainMult = 1 + Math.min(M.chain_max_extra, Math.max(0, (row.chains || []).length - 1) * M.chain_step);
    var headroom = M.headroom_floor + M.headroom_range * (1 - row.cat_tokened_share);
    var dominance = 1 + M.dominance_step * Math.sqrt(Math.max(0, row.cat_share));
    var missing = (raw === null ? 1 : 0) + (row.age_days === null || row.age_days === undefined ? 1 : 0);
    var confidence = missing === 0 ? 1 : missing === 1 ? M.confidence_missing_one : M.confidence_missing_both;
    return Math.max(1, Math.round(row.tvl_usd * row.peer_ratio * size * momentum * maturity * chainMult * headroom * dominance * confidence));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k === 'html') node.innerHTML = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
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

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('chain')) state.chain = params.get('chain');
    if (params.get('watch') === '1') state.watch = true;
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.watch) params.set('watch', '1');
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watch && !r.watchlist) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'rank') { av = a.rank; bv = b.rank; }
      else if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Token Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    var top = DATA.rows[0];
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', { text: DATA.watchlist_size + ' watchlist protocols, ranked by implied value' }),
        el('p', { text: 'The watchlist is the floor: every protocol with at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL and no token on record. This board adds ' + DATA.early_size + ' more pre-token protocols — including ones above the floor the watchlist leaves out — ranked by what the market already pays for their kind of protocol. Implied value is a model, not a promise, and never a prediction that a token will launch.' }),
        el('p', { text: top ? 'Top of the board: ' + top.name + ' at ' + fmtUsd(top.implied_value_usd) + ' implied value on ' + fmtUsd(top.tvl_usd) + ' of TVL.' : '' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Beyond the watchlist' }), el('b', { text: String(DATA.early_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Live-token protocols set aside' }), el('b', { text: String(DATA.live_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Rows with every input on record' }), el('b', { text: String(DATA.full_data_rows) + ' / ' + DATA.board_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Global peer ratio' }), el('b', { text: String(DATA.global_peer_ratio) + 'x TVL' }))
      )
    );
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.reduce(function (a, r) { return a.concat(r.chains || []); }, []))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var cat = el('select', { id: 'category', 'aria-label': 'Filter by category' },
      el('option', { value: 'all', text: 'All categories' }),
      categories.map(function (c) { return el('option', { value: c, text: c, selected: c === state.category ? 'selected' : null }); })
    );
    cat.addEventListener('change', function () { state.category = cat.value; writeHash(); render(); });
    var ch = el('select', { id: 'chain', 'aria-label': 'Filter by chain' },
      el('option', { value: 'all', text: 'All chains' }),
      chains.map(function (c) { return el('option', { value: c, text: c, selected: c === state.chain ? 'selected' : null }); })
    );
    ch.addEventListener('change', function () { state.chain = ch.value; writeHash(); render(); });
    var watch = el('input', { type: 'checkbox', id: 'watch', checked: state.watch ? 'checked' : null, 'aria-label': 'Watchlist only' });
    watch.addEventListener('change', function () { state.watch = watch.checked; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live token', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      el('div', { class: 'field' }, el('label', { for: 'category', text: 'Category' }), cat),
      el('div', { class: 'field' }, el('label', { for: 'chain', text: 'Chain' }), ch),
      el('label', { class: 'check', for: 'watch' }, watch, 'Watchlist only'),
      el('div', { class: 'field' }, el('span', { text: 'Token status' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' rows shown' : DATA.live.length + ' live-token protocols' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' v' : ' ^' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'No protocol matches that filter' }),
        el('p', { text: 'Clear the search or pick another category or chain to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.watch = false; writeHash(); render(); } })
      ));
    }
    var max = Math.max.apply(null, list.map(function (r) { return r.implied_value_usd; })) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growth = r.change_7d === null ? 'n/a' : fmtPct(r.change_7d);
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }),
          r.watchlist ? el('span', null, el('span', { class: 'badge', text: 'Watchlist' })) : null
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: growth }),
        el('td', { class: 'num', text: fmtAge(r.age_days) }),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Pre-token protocols, strongest implied value first. Select a row for its model and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('rank', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            sortHeader('age', 'Age'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', { class: 'num', text: 'live' }),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' on ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', null, el('span', { class: 'status live', text: 'already trades' }))
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { class: 'sub', text: 'Token live: these protocols already trade, so their market cap is a fact, not a model. They are set aside from the pre-token ranking.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Status' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Token' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var peers = DATA.peer_ratios.slice(0, 8);
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How implied value is computed' }),
      el('p', { class: 'sub', text: 'Every row is scored by one function of the snapshot figures. No protocol name is special-cased, and no row is hand-picked. The peer ratio is the market talking: tokened protocols in the same category, median market cap per dollar of TVL.' }),
      el('div', { class: 'formula' },
        'implied = round( tvl_usd x peer_ratio x size x momentum x maturity x chains x headroom x dominance x confidence )'
      ),
      el('p', { class: 'sub', text: 'Peer ratio: each tokened peer\u2019s mcap/TVL is clamped to ' + M.peer_min + 'x-' + M.peer_max + 'x first, so one wild peer cannot set the price (the snapshot\u2019s only Prediction Market peer trades at 400x TVL, Risk Curators\u2019 only peer at 2.98x); the category median is then shrunk toward the global median of ' + DATA.global_peer_ratio + 'x by peer count, (n x category + ' + M.shrink_k + ' x global) / (n + ' + M.shrink_k + '), and clamped again. A thin category now informs its rows instead of collapsing to the global number: Risk Curators is 0.460x on 1 peer, Onchain Capital Allocator 0.140x on 2 peers that agree at 0.006x and 0.019x, CDP 0.191x on 3 peers.' }),
      el('p', { class: 'sub', text: 'Size: (TVL / $' + Math.round(M.size_ref_usd / 1e6) + 'M) ^ -' + M.size_exponent + ', clamped to ' + M.size_min + 'x-' + M.size_max + 'x. The market pays fewer dollars of mcap per dollar of TVL as protocols get bigger — median mcap/TVL falls from 0.65x under $10M to 0.01x over $10B across the 128 priced protocols, a log-log slope near -0.48 — and the model applies half that slope, so the biggest rows are halved and the smallest doubled. Momentum: 1 + ' + M.momentum_abs_weight + ' x clamp(7d growth, ' + M.growth_floor + ', ' + M.growth_cap + ') / 100 + ' + M.momentum_rel_weight + ' x clamp(growth minus the category\u2019s PRE-TOKEN median 7d change, ' + M.rel_floor + ', ' + M.rel_cap + ') / 100, so growing in a shrinking category counts more; the +4448% week in the snapshot is clamped on both terms. The relative term is measured against pre-token protocols only, because a tokened protocol\u2019s TVL moves with its token\u2019s price while a pre-token protocol\u2019s TVL moves with deposits — the old all-protocol median handed every pre-token row in a category a free boost in a week when tokened protocols fell hard. Where no pre-token protocol in a category reports a 7d change, the all-protocol median stands in and the row says so. Maturity: ' + M.maturity_floor + ' + ' + M.maturity_range + ' x sqrt(min(age_days, ' + M.maturity_days + ') / ' + M.maturity_days + '), age being the time since first listing with no token on record; an unlisted age uses ' + M.unknown_age_days + ' days. Chains: 1 + 0.02 x min(chains - 1, 5). Headroom: ' + M.headroom_floor + ' + ' + M.headroom_range + ' x (1 - the share of the category\u2019s TVL that already belongs to tokened protocols), so a category where most value already trades has less launch headroom. Dominance: 1 + ' + M.dominance_step + ' x sqrt(this protocol\u2019s share of its category\u2019s TVL).' }),
      el('p', { class: 'sub', text: 'Confidence: 1.00x when the snapshot carries both the 7d change and the listing date, ' + M.confidence_missing_one + 'x when one of them is missing, ' + M.confidence_missing_both + 'x when both are. A missing 7d change is still scored as 0% growth and a missing listing date as a ' + M.unknown_age_days + '-day age, so the row can be scored at all — but a guess is not knowledge, and the row is discounted for the input it does not have. The discount is small on purpose: it breaks ties between a guessed row and a measured neighbour without burying a strong protocol for a gap in the snapshot\u2019s record. In this snapshot ' + (DATA.board_size - DATA.full_data_rows) + ' of the ' + DATA.board_size + ' board rows carry a discount, and each one names the inputs it is missing.' }),
      el('p', { class: 'sub', text: 'Stablecoin issuers get no extra discount, by category, never by name: a stablecoin issuer\u2019s TVL is the stablecoins outstanding, which already trade, but its peers\u2019 market caps are their governance tokens\u2019 caps — so the peer ratio already is the market\u2019s price for a stablecoin issuer\u2019s governance token per dollar of stablecoins outstanding (CDP peers: 0.008x, 0.169x, 0.246x). An extra haircut would double-count the discount the peer ratio already carries. Exchanges and versioned pools are not ranked, and above the floor a wrapped, staked or bridged product of a token that already trades is left out: WBTC is Bitcoin on Ethereum, not a launch.' }),
      el('table', { class: 'peer-table' },
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Raw peer median' }), el('th', { scope: 'col', text: 'Tokened peers' }), el('th', { scope: 'col', text: 'Ratio used' }))),
        el('tbody', null, peers.map(function (p) {
          return el('tr', null, el('td', { text: p.category }), el('td', { class: 'num', text: p.raw_ratio === null ? 'n/a' : p.raw_ratio.toFixed(3) + 'x' }), el('td', { class: 'num', text: String(p.peers) }), el('td', { class: 'num', text: p.ratio.toFixed(3) + 'x' }));
        }))
      ),
      el('p', { class: 'sub', text: 'Farm plans are derived from each protocol\u2019s own figures, never from a hand-written list: the capital follows its TVL, the hold follows its age, and the action follows its category. A lending plan borrows a fifth of the capital supplied, so the borrow always stays under the quarter its own risk step demands, and a DEX plan\u2019s range is a band 20% above and below the pool\u2019s current price, never a fixed dollar range.' }),
      el('p', { class: 'sub', text: 'Disclaimer: every protocol here records no token in the snapshot — that is DefiLlama\u2019s record, never proof it has none. Implied value is this entry\u2019s own estimate of what a token would be worth if the protocol\u2019s record stayed as it is. It is not a price, not a prediction that a token will launch, and not financial advice. Farming costs gas and puts capital at risk; the farm plan states the risk for each protocol.' })
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'brand-name', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + (row.watchlist ? '  ·  Watchlist' : '') }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Peer ratio (' + (row.category || 'Other') + ', ' + row.peer_count + ' peers; raw median ' + (row.raw_peer_ratio === null ? 'n/a' : row.raw_peer_ratio.toFixed(3) + 'x') + ')' }), el('b', { class: 'num', text: row.peer_ratio.toFixed(3) + 'x' })),
        el('div', null, el('span', { text: 'Size multiplier (TVL vs $100M)' }), el('b', { class: 'num', text: String(row.size_multiplier) })),
        el('div', null, el('span', { text: 'Seven-day growth' }), el('b', { class: 'num', text: fmtPct(row.change_7d) })),
        el('div', null, el('span', { text: 'Growth vs pre-token median in category (' + fmtPct(row.cat_median_change) + ')' + (row.cat_median_pre_token === false ? ' — fallback: no pre-token protocol in this category reports a 7d change, so the all-protocol median' : '') }), el('b', { class: 'num', text: fmtPct(row.rel_growth_pct) })),
        el('div', null, el('span', { text: 'Momentum multiplier' }), el('b', { class: 'num', text: String(row.momentum_multiplier) })),
        el('div', null, el('span', { text: 'Age with no token' }), el('b', { class: 'num', text: fmtAge(row.age_days) })),
        el('div', null, el('span', { text: 'Maturity multiplier' }), el('b', { class: 'num', text: String(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Chain multiplier (' + (row.chains || []).length + ' chains)' }), el('b', { class: 'num', text: String(row.chain_multiplier) })),
        el('div', null, el('span', { text: 'Headroom (' + Math.round(row.cat_tokened_share * 100) + '% of category TVL already tokened)' }), el('b', { class: 'num', text: String(row.headroom_multiplier) })),
        el('div', null, el('span', { text: 'Dominance (' + (row.cat_share * 100).toFixed(1) + '% of category TVL)' }), el('b', { class: 'num', text: String(row.dominance_multiplier) })),
        el('div', null, el('span', { text: 'Signal confidence' + ((row.missing_inputs && row.missing_inputs.length) ? ' — ' + row.missing_inputs.join(' + ') + ' missing from the snapshot, so the score used a guess' : ' — every input on record') }), el('b', { class: 'num', text: String(row.confidence_multiplier) + 'x' })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'Model ' + DATA.model_version + ': the same function scores every protocol. The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ', the same number board.json carries.' : ', which differs from the board: the data would be stale.') + ' This is an estimate, not a price.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, (row.farm_steps || []).map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      }))
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') shell.appendChild(modelPanel());
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();

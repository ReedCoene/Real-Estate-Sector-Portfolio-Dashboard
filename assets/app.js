'use strict';
// GSIF REIT Portfolio Dashboard

const DATA_URL = 'data/market_data.json';
const PORTFOLIO_ORDER = ['CTRE','MAC','XHR','EPRT','MRP','TRNO','SBAC'];
const SECTOR_COLORS = {
  'Healthcare': '#0ea5e9', 'Retail — Mall': '#f59e0b', 'Retail': '#f59e0b',
  'Hospitality': '#a855f7', 'Net Lease': '#10b981', 'Land Banking': '#84cc16',
  'Industrial': '#f97316', 'Infrastructure — Tower': '#6366f1', 'Tower': '#6366f1',
};

// ── Theme ──────────────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);
document.getElementById('themeToggle').addEventListener('click', () => {
  const t = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('theme', t);
});

// ── Tabs ──────────────────────────────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    btn.classList.add('active');
    document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
  });
});

// Handle URL hash tabs
const hash = location.hash.replace('#','');
if (hash) {
  const btn = document.querySelector(`.tab-btn[data-tab="${hash}"]`);
  if (btn) btn.click();
}

// ── Helpers ───────────────────────────────────────────────────
const fmt = {
  price: v => v ? `$${parseFloat(v).toFixed(2)}` : '—',
  pct:   v => v != null ? `${v > 0 ? '+' : ''}${parseFloat(v).toFixed(2)}%` : '—',
  cap:   v => { if (!v) return '—'; const b = v/1e9; return b >= 1 ? `$${b.toFixed(1)}B` : `$${(v/1e6).toFixed(0)}M`; },
  yield: v => v ? `${parseFloat(v).toFixed(2)}%` : '—',
  date:  s => { if (!s) return '—'; try { return new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); } catch { return s; } },
  since: s => {
    if (!s) return '';
    const d = new Date(s), now = new Date();
    const diff = Math.floor((now - d) / 60000);
    if (diff < 60) return `${diff}m ago`;
    if (diff < 1440) return `${Math.floor(diff/60)}h ago`;
    return `${Math.floor(diff/1440)}d ago`;
  },
  earnCountdown: s => {
    if (!s) return null;
    const d = new Date(s), now = new Date();
    const days = Math.ceil((d - now) / 86400000);
    if (days < 0) return null;
    if (days === 0) return 'Today';
    if (days === 1) return 'Tomorrow';
    return `${days}d`;
  },
};

const pctClass = v => v > 0 ? 'pos' : v < 0 ? 'neg' : '';
const sectorColor = s => SECTOR_COLORS[s] || '#94a3b8';

function newsCard(item) {
  const ago = fmt.since(item.published);
  const badge = item.ticker ? `<span class="news-ticker">${item.ticker}</span>` : '';
  const filing = item.category === 'filing' ? `<span class="news-form">${item.form || 'Filing'}</span>` : '';
  const signal = item.is_signal ? '<span class="signal-dot"></span>' : '';
  return `<article class="news-card${item.is_signal ? ' is-signal' : ''}">
    <div class="news-meta">${signal}${badge}${filing}<span class="news-source">${item.source}</span><span class="news-ago">${ago}</span></div>
    <a class="news-title" href="${item.link}" target="_blank" rel="noopener">${item.title}</a>
    ${item.summary ? `<p class="news-summary">${item.summary}</p>` : ''}
  </article>`;
}

// ── Portfolio Overview Tab ────────────────────────────────────
function renderOverview(data) {
  const port = data.portfolio || {};
  const cards = PORTFOLIO_ORDER.map(t => {
    const s = port[t]; if (!s) return '';
    const fd = (data.focus_details || {})[t] || {};
    const sector = fd.sector || s.sector || '';
    const color  = sectorColor(sector);
    const cd = fmt.earnCountdown(s.next_earnings);
    const earningsHtml = s.next_earnings
      ? `<div class="ov-row"><span>Next ER</span><span>${fmt.date(s.next_earnings)}${cd ? ` <em class="countdown">(${cd})</em>` : ''}</span></div>`
      : '';
    return `<div class="ov-card" onclick="document.querySelector('.tab-btn[data-tab=\\"${t}\\"]').click()">
      <div class="ov-card-header" style="border-left:3px solid ${color}">
        <div>
          <span class="ov-ticker">${t}</span>
          <span class="ov-sector" style="color:${color}">${sector}</span>
        </div>
        <div class="ov-price-block">
          <span class="ov-price">${fmt.price(s.price)}</span>
          <span class="ov-chg ${pctClass(s.pct_change)}">${fmt.pct(s.pct_change)}</span>
        </div>
      </div>
      <div class="ov-body">
        <div class="ov-row"><span>Mkt Cap</span><span>${fmt.cap(s.market_cap)}</span></div>
        <div class="ov-row"><span>Yield</span><span>${fmt.yield(s.dividend_yield)}</span></div>
        ${earningsHtml}
        <div class="ov-52w">
          <div class="range-bar-wrap">
            <div class="range-bar">
              <div class="range-fill" style="left:${pctInRange(s)}%;width:4px"></div>
            </div>
            <div class="range-labels"><span>${fmt.price(s.fifty_two_week_low)}</span><span>52W</span><span>${fmt.price(s.fifty_two_week_high)}</span></div>
          </div>
        </div>
      </div>
    </div>`;
  }).join('');

  const movers = (data.top_gainers || []).concat(data.top_losers || []);
  const moverCards = movers.slice(0,6).map(s =>
    `<div class="mover-chip ${pctClass(s.pct_change)}">${s.ticker} <strong>${fmt.pct(s.pct_change)}</strong></div>`
  ).join('');

  document.getElementById('portfolioOverview').innerHTML = `
    <div class="section">
      <div class="section-header"><h2>Holdings</h2><span class="section-note">${fmt.date(data.market_date || '')} &mdash; click any card to open</span></div>
      <div class="ov-grid">${cards}</div>
    </div>
    ${moverCards ? `<div class="section"><div class="section-header"><h2>Today's Movers</h2></div><div class="movers-row">${moverCards}</div></div>` : ''}
    <div class="section">
      <div class="section-header"><h2>Peers Snapshot</h2></div>
      ${renderPeersTable(data.peers || {})}
    </div>`;
}

function pctInRange(s) {
  const lo = s.fifty_two_week_low, hi = s.fifty_two_week_high, p = s.price;
  if (!lo || !hi || hi === lo) return 50;
  return Math.max(0, Math.min(100, ((p - lo) / (hi - lo)) * 100));
}

function renderPeersTable(peers) {
  if (!Object.keys(peers).length) return '<p class="empty-msg">No peer data</p>';
  const rows = Object.values(peers).map(s =>
    `<tr><td>${s.ticker}</td><td class="col-name">${s.name}</td>
     <td class="col-num">${fmt.price(s.price)}</td>
     <td class="col-num ${pctClass(s.pct_change)}">${fmt.pct(s.pct_change)}</td>
     <td class="col-num">${fmt.cap(s.market_cap)}</td>
     <td class="col-num">${fmt.yield(s.dividend_yield)}</td>
     <td>${s.next_earnings ? fmt.date(s.next_earnings) : '—'}</td></tr>`
  ).join('');
  return `<div class="table-scroll"><table class="reit-table">
    <thead><tr><th>Ticker</th><th class="col-name">Company</th>
    <th class="col-num">Price</th><th class="col-num">Day %</th>
    <th class="col-num">Mkt Cap</th><th class="col-num">Yield</th><th>Next ER</th></tr></thead>
    <tbody>${rows}</tbody></table></div>`;
}

// ── Today's Brief Tab ─────────────────────────────────────────
function renderBrief(data) {
  const port = data.portfolio || {};
  const allUp   = PORTFOLIO_ORDER.filter(t => port[t]?.pct_change > 0).length;
  const allDown  = PORTFOLIO_ORDER.filter(t => port[t]?.pct_change < 0).length;

  const portRows = PORTFOLIO_ORDER.map(t => {
    const s = port[t]; if (!s) return '';
    const fd = (data.focus_details || {})[t] || {};
    const color = sectorColor(fd.sector || '');
    return `<div class="brief-holding-row">
      <span class="brief-ticker" style="color:${color}">${t}</span>
      <span class="brief-name">${s.name}</span>
      <span class="brief-price">${fmt.price(s.price)}</span>
      <span class="brief-chg ${pctClass(s.pct_change)}">${fmt.pct(s.pct_change)}</span>
    </div>`;
  }).join('');

  const signalNews = (data.news || []).filter(n => n.is_signal && (PORTFOLIO_ORDER.includes(n.ticker) || n.is_portfolio)).slice(0, 8);
  const signalHtml = signalNews.length ? signalNews.map(newsCard).join('') : '<p class="empty-msg">No signals today</p>';

  document.getElementById('todaysBrief').innerHTML = `
    <div class="section">
      <div class="section-header"><h2>Portfolio Pulse</h2><span class="section-note">${allUp} up &bull; ${allDown} down</span></div>
      <div class="brief-holdings">${portRows}</div>
    </div>
    <div class="section">
      <div class="section-header"><h2>Portfolio Signals</h2></div>
      <div class="news-grid">${signalHtml}</div>
    </div>`;
}

// ── Individual Holding Tab ────────────────────────────────────
function renderHolding(ticker, data) {
  const s  = (data.portfolio || {})[ticker];
  const fd = (data.focus_details || {})[ticker] || {};
  const el = document.querySelector(`.holding-panel[data-ticker="${ticker}"]`);
  if (!el || !s) return;

  const sector = fd.sector || s.sector || '';
  const color  = sectorColor(sector);
  const cd = s.next_earnings ? fmt.earnCountdown(s.next_earnings) : null;

  // Hero metric cards
  const hero = `<div class="hero-cards">
    <div class="hero-card main-price">
      <p class="hc-label">${ticker} &mdash; ${s.name}</p>
      <p class="hc-price">${fmt.price(s.price)}</p>
      <p class="hc-chg ${pctClass(s.pct_change)}">${fmt.pct(s.pct_change)} today</p>
      <span class="sector-pill" style="background:${color}22;color:${color}">${sector}</span>
    </div>
    <div class="hero-card"><p class="hc-label">Market Cap</p><p class="hc-val">${fmt.cap(s.market_cap)}</p></div>
    <div class="hero-card"><p class="hc-label">Dividend Yield</p><p class="hc-val">${fmt.yield(s.dividend_yield)}</p></div>
    <div class="hero-card">
      <p class="hc-label">Next Earnings</p>
      <p class="hc-val">${fmt.date(s.next_earnings)}</p>
      ${cd ? `<p class="hc-sub countdown">${cd}</p>` : ''}
    </div>
    <div class="hero-card">
      <p class="hc-label">52-Week Range</p>
      <p class="hc-val">${fmt.price(s.fifty_two_week_low)} – ${fmt.price(s.fifty_two_week_high)}</p>
      <div class="range-bar-wrap small"><div class="range-bar"><div class="range-fill" style="left:${pctInRange(s)}%;width:4px"></div></div></div>
    </div>
  </div>`;

  // Thesis
  const thesisItems = (fd.thesis_points || []).map(t => `<li>${t}</li>`).join('');
  const thesis = thesisItems ? `<div class="section">
    <div class="section-header"><h2>Investment Thesis</h2></div>
    <ul class="thesis-list">${thesisItems}</ul>
  </div>` : '';

  // Key debate
  const debateHtml = fd.key_debate ? `<div class="section">
    <div class="section-header"><h2>Key Debate</h2></div>
    <div class="debate-grid">
      <div class="debate-card street"><strong>Street View</strong><p>${fd.key_debate.street}</p></div>
      <div class="debate-card ours"><strong>Our View</strong><p>${fd.key_debate.our_view}</p></div>
    </div>
  </div>` : '';

  // Key dates + analyst coverage
  const dates = (fd.key_dates || []).map(d =>
    `<div class="kd-row"><span class="kd-event">${d.event}</span><span class="kd-date">${d.date}</span><span class="kd-note">${d.note || ''}</span></div>`
  ).join('');
  const analysts = (fd.analyst_coverage || []).map(a =>
    `<div class="analyst-row"><span class="af-firm">${a.firm}</span>
     <span class="af-rating ${a.rating?.toLowerCase() === 'buy' || a.rating?.toLowerCase() === 'outperform' || a.rating?.toLowerCase() === 'overweight' ? 'bull' : ''}">${a.rating}</span>
     <span class="af-target">${a.target ? `$${a.target}` : '—'}</span>
     <span class="af-date">${a.date}</span></div>`
  ).join('');

  const metaGrid = `<div class="meta-grid">
    ${dates ? `<div class="section"><div class="section-header"><h2>Key Dates</h2></div>${dates}</div>` : ''}
    ${analysts ? `<div class="section"><div class="section-header"><h2>Analyst Coverage</h2></div>${analysts}</div>` : ''}
    ${fd.risks?.length ? `<div class="section"><div class="section-header"><h2>Key Risks</h2></div><ul class="risk-list">${fd.risks.map(r=>`<li>${r}</li>`).join('')}</ul></div>` : ''}
  </div>`;

  // Peers comparison
  const peers = fd.peers || [];
  const peerRows = peers.map(p => {
    const ps = (data.peers || {})[p] || (data.portfolio || {})[p];
    if (!ps) return '';
    return `<tr><td>${ps.ticker}</td><td class="col-name">${ps.name}</td>
      <td class="col-num">${fmt.price(ps.price)}</td>
      <td class="col-num ${pctClass(ps.pct_change)}">${fmt.pct(ps.pct_change)}</td>
      <td class="col-num">${fmt.cap(ps.market_cap)}</td>
      <td class="col-num">${fmt.yield(ps.dividend_yield)}</td></tr>`;
  }).filter(Boolean).join('');
  const peersHtml = peerRows ? `<div class="section">
    <div class="section-header"><h2>Sector Peers</h2></div>
    <div class="table-scroll"><table class="reit-table">
      <thead><tr><th>Ticker</th><th class="col-name">Company</th><th class="col-num">Price</th><th class="col-num">Day %</th><th class="col-num">Mkt Cap</th><th class="col-num">Yield</th></tr></thead>
      <tbody>${peerRows}</tbody></table></div></div>` : '';

  // Ticker news
  const tickerNews = (data.news || []).filter(n => n.ticker === ticker).slice(0, 15).map(newsCard).join('');
  const secFilings = (data.news || []).filter(n => n.ticker === ticker && n.category === 'filing').slice(0,5).map(newsCard).join('');

  el.innerHTML = hero + thesis + debateHtml + metaGrid + peersHtml +
    `<div class="section"><div class="section-header"><h2>${ticker} News</h2></div><div class="news-grid">${tickerNews || '<p class="empty-msg">No news</p>'}</div></div>` +
    (secFilings ? `<div class="section"><div class="section-header"><h2>SEC Filings</h2></div><div class="news-grid">${secFilings}</div></div>` : '');
}

// ── News Tab ──────────────────────────────────────────────────
function renderNews(data) {
  const allNews = data.news || [];
  const grid = document.getElementById('newsGrid');

  function applyFilter(cat) {
    document.querySelectorAll('#newsCatFilters .cat-btn').forEach(b => b.classList.toggle('active', b.dataset.hcat === cat));
    let items = allNews;
    if (cat === 'portfolio') items = allNews.filter(n => PORTFOLIO_ORDER.includes(n.ticker));
    else if (cat === 'filing')  items = allNews.filter(n => n.category === 'filing');
    else if (cat === 'signal')  items = allNews.filter(n => n.is_signal);
    else if (cat !== 'all')     items = allNews.filter(n => n.category === cat || (n.ticker && PORTFOLIO_ORDER.includes(n.ticker) && cat === 'portfolio'));
    grid.innerHTML = items.slice(0, 80).map(newsCard).join('') || '<p class="empty-msg">No news</p>';
  }

  document.querySelectorAll('#newsCatFilters .cat-btn').forEach(b =>
    b.addEventListener('click', () => applyFilter(b.dataset.hcat))
  );
  applyFilter('all');
}

// ── Weekly Report Tab ─────────────────────────────────────────
function renderWeekly(data) {
  const w = data.weekly_report;
  const el = document.getElementById('weeklyReport');
  if (!w) { el.innerHTML = '<div class="section"><p class="empty-msg">Weekly report generated on Sundays after market close.</p></div>'; return; }

  const gainerRows = (w.top_gainers || []).map(m =>
    `<div class="mover-chip pos">${m.ticker} <strong>+${m.weekly_pct?.toFixed(2)}%</strong></div>`).join('');
  const loserRows = (w.top_losers || []).map(m =>
    `<div class="mover-chip neg">${m.ticker} <strong>${m.weekly_pct?.toFixed(2)}%</strong></div>`).join('');
  const signals = (w.key_signals || []).map(s => `<li>${s}</li>`).join('');
  const broad   = (w.broad_highlights || []).map(s => `<li>${s}</li>`).join('');

  el.innerHTML = `<div class="section">
    <div class="section-header"><h2>Week Ending ${w.week_ending}</h2><span class="section-note">${w.advancing} advancing &bull; ${w.declining} declining</span></div>
    <div class="weekly-movers">
      <div><h3 class="pos">Top Gainers</h3><div class="movers-row">${gainerRows}</div></div>
      <div><h3 class="neg">Top Losers</h3><div class="movers-row">${loserRows}</div></div>
    </div>
    ${signals ? `<div class="section-sub"><h3>Portfolio Signals</h3><ul>${signals}</ul></div>` : ''}
    ${broad   ? `<div class="section-sub"><h3>Sector Highlights</h3><ul>${broad}</ul></div>` : ''}
  </div>`;
}

// ── Bootstrap ─────────────────────────────────────────────────
fetch(DATA_URL + '?_=' + Date.now())
  .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
  .then(data => {
    // Header metadata
    document.getElementById('marketDate').textContent = data.market_date || '—';
    const ago = fmt.since(data.last_updated);
    document.getElementById('lastUpdated').textContent = `Updated ${ago}`;

    // Alert if stale
    const updatedAt = new Date(data.last_updated);
    if ((Date.now() - updatedAt) > 86400000 * 2) {
      const b = document.getElementById('alertBanner');
      b.textContent = 'Data may be stale — last updated ' + fmt.date(data.last_updated);
      b.classList.remove('hidden');
    }

    // Render all tabs
    renderOverview(data);
    renderBrief(data);
    PORTFOLIO_ORDER.forEach(t => renderHolding(t, data));
    renderNews(data);
    renderWeekly(data);
  })
  .catch(err => {
    document.getElementById('lastUpdated').textContent = 'Failed to load data';
    console.error('Data load error:', err);
  });

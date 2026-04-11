// ── Theme ────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved === 'light') document.body.classList.add('light');
  document.getElementById('themeToggle').addEventListener('click', () => {
    document.body.classList.toggle('light');
    localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
  });
}
initTheme();

// ── Sector Config ─────────────────────────────────────────────
const SECTOR_CONFIG = {
  overview: {
    focus: null, label: 'REIT Sector Overview',
    subtitle: 'All Sectors \u00b7 Daily Market Snapshot',
    sectorName: 'overview', newsCategory: 'broad',
    newsTabLabel: 'REIT News', sectorCatLabel: 'All REIT',
    coverageNote: 'All REITs \u2014 click column headers to sort',
  },
  healthcare:  {
    focus: 'CTRE', label: 'Healthcare REIT Dashboard',
    subtitle: 'Skilled Nursing \u00b7 Assisted Living \u00b7 Medical',
    sectorName: 'healthcare', newsCategory: 'healthcare',
    newsTabLabel: 'Healthcare News', sectorCatLabel: 'Healthcare',
    coverageNote: 'Healthcare REITs \u2014 click column headers to sort',
  },
  housing: {
    focus: 'MRP', label: 'Residential REIT Dashboard',
    subtitle: 'Land Banking \u00b7 Homebuilders \u00b7 Residential',
    sectorName: 'housing', newsCategory: 'housing',
    newsTabLabel: 'Residential News', sectorCatLabel: 'Residential',
    coverageNote: 'Residential REITs \u2014 click column headers to sort',
  },
  industrial: {
    focus: 'TRNO', label: 'Industrial REIT Dashboard',
    subtitle: 'Logistics \u00b7 Warehouse \u00b7 Distribution',
    sectorName: 'industrial', newsCategory: 'industrial',
    newsTabLabel: 'Industrial News', sectorCatLabel: 'Logistics / Warehouse',
    coverageNote: 'Industrial REITs \u2014 click column headers to sort',
  },
  retail: {
    focus: 'MAC', label: 'Retail REIT Dashboard',
    subtitle: 'Class A Malls \u00b7 Open-Air \u00b7 Experiential Retail',
    sectorName: 'retail', newsCategory: 'retail',
    newsTabLabel: 'Retail News', sectorCatLabel: 'Retail / Mall',
    coverageNote: 'Retail REITs \u2014 click column headers to sort',
  },
  hospitality: {
    focus: 'XHR', label: 'Hospitality REIT Dashboard',
    subtitle: 'Upper-Upscale Hotels \u00b7 Resort \u00b7 Urban',
    sectorName: 'hospitality', newsCategory: 'hospitality',
    newsTabLabel: 'Hospitality News', sectorCatLabel: 'Hotels',
    coverageNote: 'Hospitality REITs \u2014 click column headers to sort',
  },
  netlease: {
    focus: 'EPRT', label: 'Net Lease REIT Dashboard',
    subtitle: 'Single-Tenant \u00b7 NNN \u00b7 Essential Services',
    sectorName: 'net lease', newsCategory: null,
    newsTabLabel: 'Net Lease News', sectorCatLabel: 'Net Lease',
    coverageNote: 'Net Lease REITs \u2014 click column headers to sort',
  },
  tower: {
    focus: 'SBAC', label: 'Tower REIT Dashboard',
    subtitle: 'Cell Towers \u00b7 5G Infrastructure \u00b7 Global',
    sectorName: 'tower', newsCategory: 'towers',
    newsTabLabel: 'Tower News', sectorCatLabel: 'Towers / 5G',
    coverageNote: 'Tower REITs \u2014 click column headers to sort',
  },
  office: {
    focus: null, label: 'Office REIT Dashboard',
    subtitle: 'CBD \u00b7 Suburban \u00b7 Life Science \u00b7 Government',
    sectorName: 'office', newsCategory: 'office',
    newsTabLabel: 'Office News', sectorCatLabel: 'Office',
    coverageNote: 'Office REITs \u2014 click column headers to sort',
  },
};

const BIG_MOVE = 2.5;
let currentSector = localStorage.getItem('sector') || 'overview';
let TRACKED = new Set([SECTOR_CONFIG[currentSector].focus]);

// ── Formatters ───────────────────────────────────────────────
const fmtPrice = v => v != null ? '$' + Number(v).toFixed(2) : '\u2014';
const fmtYield = v => (v && v > 0) ? Number(v).toFixed(2) + '%' : '\u2014';
const fmtCap   = v => {
  if (!v) return '\u2014';
  if (v >= 1e12) return '$' + (v/1e12).toFixed(1) + 'T';
  if (v >= 1e9)  return '$' + (v/1e9).toFixed(1) + 'B';
  if (v >= 1e6)  return '$' + (v/1e6).toFixed(0) + 'M';
  return '$' + v;
};
const fmtChange = pct => {
  if (pct == null) return { text: '\u2014', cls: 'flat' };
  const abs  = Math.abs(pct);
  const sign = pct > 0 ? '+' : pct < 0 ? '\u2212' : '';
  return { text: `${sign}${abs.toFixed(2)}%`, cls: pct > 0 ? 'up' : pct < 0 ? 'down' : 'flat' };
};
const timeSince = str => {
  if (!str) return '';
  const d = new Date(str);
  if (isNaN(d)) return str;
  const s = (Date.now() - d) / 1000;
  if (s < 3600)  return Math.round(s/60) + 'm ago';
  if (s < 86400) return Math.round(s/3600) + 'h ago';
  return Math.round(s/86400) + 'd ago';
};
const rangeBar = s => {
  const { price: p, fifty_two_week_low: lo, fifty_two_week_high: hi } = s;
  if (!lo || !hi || hi === lo) return '<span class="flat">\u2014</span>';
  const pct = Math.max(0, Math.min(100, ((p - lo) / (hi - lo)) * 100));
  return `<div class="range-bar-wrap">
    <span>${fmtPrice(lo)}</span>
    <div class="range-bar-track"><div class="range-bar-fill" style="width:${pct.toFixed(1)}%"></div></div>
    <span>${fmtPrice(hi)}</span>
  </div>`;
};

// ── Tabs ─────────────────────────────────────────────────────
function initTabs() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
      btn.classList.add('active');
      document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
    });
  });
}

// ── Alert Banner ─────────────────────────────────────────────
function renderAlert(stocks) {
  const big = Object.values(stocks)
    .filter(s => Math.abs(s.pct_change) >= BIG_MOVE)
    .sort((a, b) => Math.abs(b.pct_change) - Math.abs(a.pct_change));
  const el = document.getElementById('alertBanner');
  if (!big.length) { el.classList.add('hidden'); return; }
  const parts = big.map(s => {
    const { text } = fmtChange(s.pct_change);
    return `<strong>${s.ticker}</strong> ${text}`;
  });
  el.innerHTML = `<strong>Notable moves today:</strong> ${parts.join(' \u00a0\u2022\u00a0 ')}`;
  el.classList.remove('hidden');
}

// ── Daily Summary Helper ──────────────────────────────────────
function summaryBox(title, date, items, accentColor) {
  const color = accentColor || 'var(--accent)';
  const bullets = items.map(item => {
    const cls = item.cls ? ` class="${item.cls}"` : '';
    return `<li class="daily-summary-item"${cls}>${item.html}</li>`;
  }).join('');
  return `
    <div class="daily-summary" style="border-left-color:${color}">
      <div class="daily-summary-header">
        <span class="daily-summary-title" style="color:${color}">${title}</span>
        <span class="daily-summary-date">${date}</span>
      </div>
      <ul class="daily-summary-items">${bullets}</ul>
    </div>`;
}

// ── Focus: Daily Summary ──────────────────────────────────────
function renderFocusSummary(sData) {
  const focus = sData.focus_ticker;
  const s     = sData.stocks[focus];
  const cd    = sData.focus_details || {};
  if (!s) { document.getElementById('focusSummary').innerHTML = ''; return; }
  const { text, cls } = fmtChange(s.pct_change);
  const items = [];

  items.push({ html: `${focus} <span class="${cls}">${text}</span> to ${fmtPrice(s.price)} today` });

  const focusSignals = (sData.news || []).filter(n => n.ticker === focus && n.is_signal);
  if (focusSignals.length) {
    const n = focusSignals[0];
    const link = n.link
      ? `<a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>`
      : n.title;
    items.push({ html: `Latest signal: ${link}` });
  }

  const dates = cd.key_dates || [];
  if (dates.length) {
    const next = dates[0];
    items.push({ html: `Next: <strong>${next.event}</strong> \u2014 ${next.date}` });
  }

  const analysts = cd.analyst_coverage || [];
  if (analysts.length) {
    const buys = analysts.filter(a => ['Outperform','Overweight','Buy'].includes(a.rating));
    if (buys.length) {
      const targets = buys.map(a => `${a.firm} $${a.target}`).join(', ');
      items.push({ html: `Buy-side coverage: ${targets}` });
    }
  }

  document.getElementById('focusSummary').innerHTML =
    summaryBox("Today's Summary", sData.market_date || '\u2014', items, 'var(--accent)');
}

// ── All REITs: Daily Summary ──────────────────────────────────
function renderREITsSummary(sData) {
  const arr       = Object.values(sData.stocks);
  const advancing = arr.filter(x => x.pct_change > 0).length;
  const declining = arr.filter(x => x.pct_change < 0).length;
  const unchanged = arr.length - advancing - declining;
  const sorted    = [...arr].sort((a, b) => b.pct_change - a.pct_change);
  const top       = sorted[0];
  const bottom    = sorted[sorted.length - 1];

  const items = [];

  items.push({
    html: `Sector breadth: <span class="up">${advancing} advancing</span> / <span class="down">${declining} declining</span>${unchanged ? ` / ${unchanged} unchanged` : ''} of ${arr.length} REITs`
  });

  if (top) {
    const { text } = fmtChange(top.pct_change);
    items.push({ html: `Top gainer: <strong>${top.ticker}</strong> <span class="up">${text}</span> to ${fmtPrice(top.price)}` });
  }

  if (bottom && bottom.pct_change < 0) {
    const { text } = fmtChange(bottom.pct_change);
    items.push({ html: `Top loser: <strong>${bottom.ticker}</strong> <span class="down">${text}</span> to ${fmtPrice(bottom.price)}` });
  }

  const cutoff = Date.now() - 48 * 3600 * 1000;
  const todaySignals = (sData.news || []).filter(n =>
    n.ticker && n.is_signal && new Date(n.published).getTime() >= cutoff
  );
  if (todaySignals.length) {
    const s = todaySignals[0];
    const link = s.link
      ? `<a href="${s.link}" target="_blank" rel="noopener">${s.title}</a>`
      : s.title;
    items.push({ html: `Key signal: ${link}` });
    if (todaySignals.length > 1) {
      items.push({ html: `+${todaySignals.length - 1} more REIT signal${todaySignals.length > 2 ? 's' : ''} today` });
    }
  }

  const color = advancing >= declining ? 'var(--green)' : 'var(--accent)';
  document.getElementById('reitsSummary').innerHTML =
    summaryBox("Today's Summary", sData.market_date || '\u2014', items, color);
}

// ── Sector News: Daily Summary ────────────────────────────────
function renderSectorSummary(sData) {
  const broadNews = (sData.news || []).filter(n => !n.ticker);
  const signals   = broadNews.filter(n => n.is_signal).slice(0, 3);
  const items     = [];
  const sName     = SECTOR_CONFIG[currentSector].sectorName;

  if (!signals.length) {
    items.push({ html: `No major ${sName} signals today \u2014 check back after market close.` });
  } else {
    signals.forEach(n => {
      const link = n.link
        ? `<a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>`
        : n.title;
      items.push({ html: `[${n.source}] ${link}` });
    });
  }

  document.getElementById('sectorSummary').innerHTML =
    summaryBox("Today's Top Stories", sData.market_date || '\u2014', items, 'var(--purple)');
}

// ── Focus Stock Tab ───────────────────────────────────────────
function renderFocus(sData) {
  const focus = sData.focus_ticker;
  const s     = sData.stocks[focus];
  if (!s) {
    document.getElementById('focusHero').innerHTML = '<p class="empty-msg">No data yet \u2014 workflow hasn\'t run yet.</p>';
    return;
  }
  const cd = sData.focus_details || {};
  const { text, cls } = fmtChange(s.pct_change);

  document.getElementById('focusHero').innerHTML = `
    <div class="ctre-hero">
      <div class="ctre-hero-left">
        <h2>${cd.name || focus} &nbsp;&mdash;&nbsp; ${cd.exchange || 'NYSE'}: ${focus}</h2>
        <div class="ctre-price">${fmtPrice(s.price)}</div>
        <div class="ctre-change-pill ${cls}">${text} today</div>
      </div>
      <div class="ctre-metrics">
        <div class="ctre-metric-item">
          <div class="ctre-metric-label">Market Cap</div>
          <div class="ctre-metric-value">${fmtCap(s.market_cap)}</div>
        </div>
        <div class="ctre-metric-item">
          <div class="ctre-metric-label">Div. Yield</div>
          <div class="ctre-metric-value">${fmtYield(s.dividend_yield)}</div>
        </div>
        <div class="ctre-metric-item">
          <div class="ctre-metric-label">52W High</div>
          <div class="ctre-metric-value">${fmtPrice(s.fifty_two_week_high)}</div>
        </div>
        <div class="ctre-metric-item">
          <div class="ctre-metric-label">52W Low</div>
          <div class="ctre-metric-value">${fmtPrice(s.fifty_two_week_low)}</div>
        </div>
        ${s.next_earnings ? (() => {
          const days = Math.round((new Date(s.next_earnings) - new Date()) / (1000*60*60*24));
          const label = days < 0 ? 'Reported' : days === 0 ? 'Today' : `${days}d away`;
          const ecls  = days >= 0 && days <= 21 ? 'up' : 'flat';
          return `<div class="ctre-metric-item">
            <div class="ctre-metric-label">Next Earnings</div>
            <div class="ctre-metric-value">${s.next_earnings}</div>
            <div style="margin-top:4px"><span class="pct-pill ${ecls}" style="font-size:11px">${label}</span></div>
          </div>`;
        })() : ''}
      </div>
    </div>`;

  const points = cd.thesis_points || [];
  document.getElementById('focusThesis').innerHTML = `
    <div class="panel">
      <h3>Investment Thesis</h3>
      <ul class="thesis-list">${points.map(p => `<li>${p}</li>`).join('')}</ul>
    </div>`;

  const dates = cd.key_dates || [];
  document.getElementById('focusDates').innerHTML = `
    <div class="panel">
      <h3>Key Dates</h3>
      <ul class="dates-list">${dates.map(d => `
        <li class="date-item">
          <div class="date-event">${d.event}</div>
          <div class="date-when">${d.date}</div>
          <div class="date-note">${d.note}</div>
        </li>`).join('')}</ul>
    </div>`;

  const analysts = cd.analyst_coverage || [];
  document.getElementById('focusAnalysts').innerHTML = `
    <div class="panel">
      <h3>Analyst Coverage</h3>
      <table class="analyst-table">
        <thead><tr><th>Firm</th><th>Rating</th><th>Target</th><th>Date</th></tr></thead>
        <tbody>${analysts.map(a => {
          const ratingCls = 'rating-' + a.rating.toLowerCase().replace(/\s+/g, '');
          return `<tr>
            <td>${a.firm}</td>
            <td class="${ratingCls}">${a.rating}</td>
            <td>$${a.target}</td>
            <td style="color:var(--t4)">${a.date}</td>
          </tr>`;
        }).join('')}</tbody>
      </table>
    </div>`;

  const focusNews = (sData.news || []).filter(n => n.ticker === focus);
  const focusEl   = document.getElementById('focusNews');
  if (!focusNews.length) { focusEl.innerHTML = '<p class="empty-msg">No recent news.</p>'; return; }
  focusEl.innerHTML = focusNews.map(n => `
    <div class="news-card" style="margin-bottom:8px">
      <div class="card-meta">
        <span class="card-source ${n.is_signal ? 'signal-src' : ''}">${focus}</span>
        <span class="card-date">${timeSince(n.published)}</span>
      </div>
      <div class="card-title">${n.link ? `<a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>` : n.title}</div>
    </div>`).join('');
}

// ── All REITs: Movers ─────────────────────────────────────────
function renderMovers(stocks) {
  const sorted  = Object.values(stocks).sort((a, b) => b.pct_change - a.pct_change);
  const gainers = sorted.slice(0, 3);
  const losers  = sorted.slice(-3).reverse();
  document.getElementById('moversRow').innerHTML = [...gainers, ...losers].map(s => {
    const isGain = s.pct_change >= 0;
    const { text } = fmtChange(s.pct_change);
    const dot = TRACKED.has(s.ticker) ? '<div class="tracked-dot" title="Focus position"></div>' : '';
    return `<div class="mover-card ${isGain ? 'gain' : 'loss'}">
      ${dot}
      <div class="mover-ticker">${s.ticker}</div>
      <div class="mover-company">${s.name}</div>
      <div class="mover-price">${fmtPrice(s.price)}</div>
      <div class="mover-change ${isGain ? 'up' : 'down'}">${text}</div>
    </div>`;
  }).join('');
}

// ── All REITs: Coverage Table ─────────────────────────────────
let sortState = { col: 'pct_change', dir: 'desc' };
function renderTable(stocks) {
  const rows = Object.values(stocks).sort((a, b) => {
    const dir = sortState.dir === 'asc' ? 1 : -1;
    const va  = a[sortState.col] ?? -Infinity;
    const vb  = b[sortState.col] ?? -Infinity;
    return (va < vb ? -1 : va > vb ? 1 : 0) * dir;
  });
  document.getElementById('tableBody').innerHTML = rows.map(s => {
    const ch      = fmtChange(s.pct_change);
    const tracked = TRACKED.has(s.ticker);
    return `<tr class="${tracked ? 'tracked-row' : ''}">
      <td><div class="ticker-cell">
        <span class="ticker-tag">${s.ticker}</span>
        ${tracked ? '<span class="tracked-badge">FOCUS</span>' : ''}
      </div></td>
      <td class="company-name">${s.name}</td>
      <td class="col-num">${fmtPrice(s.price)}</td>
      <td class="col-num"><span class="pct-pill ${ch.cls}">${ch.text}</span></td>
      <td class="col-num">${fmtCap(s.market_cap)}</td>
      <td class="col-num">${fmtYield(s.dividend_yield)}</td>
      <td class="col-num" style="color:var(--t4);font-size:11px">${s.next_earnings || '\u2014'}</td>
      <td class="col-range">${rangeBar(s)}</td>
    </tr>`;
  }).join('');

  document.querySelectorAll('.reit-table th.sortable').forEach(th => {
    th.classList.remove('sorted-asc', 'sorted-desc');
    if (th.dataset.col === sortState.col)
      th.classList.add(sortState.dir === 'asc' ? 'sorted-asc' : 'sorted-desc');
  });
}
function attachTableSort() {
  document.querySelectorAll('.reit-table th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      sortState = { col, dir: sortState.col === col && sortState.dir === 'desc' ? 'asc' : 'desc' };
      const sData = window._data.sectors[currentSector];
      renderTable(sData ? sData.stocks : {});
    });
  });
}

// ── Sector News Tab ───────────────────────────────────────────
let sectorCat = 'all';

function renderSectorNewsTab(news) {
  const cfg         = SECTOR_CONFIG[currentSector];
  const newsCategory = cfg.newsCategory;

  // Default: show all sector-filtered news (tickers + industry + filings)
  let filtered = [...news];

  if (sectorCat === 'broad')  filtered = news.filter(n => n.category === 'broad');
  if (sectorCat === 'sector') filtered = newsCategory
    ? news.filter(n => n.category === newsCategory || (n.ticker != null && n.category !== 'filing' && n.category !== 'broad'))
    : news.filter(n => n.ticker != null && n.category !== 'filing' && n.category !== 'broad');
  if (sectorCat === 'signal') filtered = news.filter(n => n.is_signal);
  if (sectorCat === 'filing') filtered = news.filter(n => n.category === 'filing');

  const el = document.getElementById('sectorNewsGrid');
  if (!filtered.length) { el.innerHTML = '<p class="empty-msg">No news for this filter.</p>'; return; }

  el.innerHTML = `<div class="news-grid-layout">` +
    filtered.slice(0, 40).map(n => {
      const isFiling   = n.category === 'filing';
      const isSector   = n.category === newsCategory && newsCategory != null;
      const isPriority = n.is_priority;
      const srcCls = isFiling
        ? (isPriority ? 'filing-priority-src' : 'filing-src')
        : isSector ? 'sector-src' : (n.is_signal ? 'signal-src' : '');
      const cardCls = isFiling
        ? (isPriority ? 'filing-priority-card' : 'filing-card')
        : isSector ? 'sector-card' : 'broad-card';
      const formBadge = isFiling
        ? `<span class="form-badge ${isPriority ? 'form-priority' : 'form-secondary'}">${n.form}</span>`
        : '';
      return `<div class="news-card ${cardCls}" style="margin-bottom:0">
        <div class="card-meta">
          ${formBadge}<span class="card-source ${srcCls}">${n.ticker || n.source || 'Industry'}</span>
          <span class="card-date">${timeSince(n.published)}</span>
        </div>
        <div class="card-title">${n.link ? `<a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>` : n.title}</div>
      </div>`;
    }).join('') + `</div>`;
}

function initSectorCatFilters() {
  document.querySelectorAll('#sectorCatFilters .cat-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#sectorCatFilters .cat-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      sectorCat = btn.dataset.hcat;
      const sData = window._data.sectors[currentSector];
      renderSectorNewsTab(sData ? sData.news || [] : []);
    });
  });
}

// ── End of Week Report ────────────────────────────────────────
function renderWeeklyReport(sData) {
  const el  = document.getElementById('weeklyReport');
  const wr  = sData.weekly_report;
  const cfg = SECTOR_CONFIG[currentSector];

  if (!wr) {
    el.innerHTML = `
      <div class="weekly-empty">
        <div class="weekly-empty-icon">&#x1F4CB;</div>
        <h2>No report yet this week</h2>
        <p>The End of Week Report is generated every Sunday after market close and covers the full week's price action, key signals, and macro highlights.</p>
        <p class="weekly-empty-sub">Check back Sunday evening.</p>
      </div>`;
    return;
  }

  const moverRow = (movers, cls) => movers.map(m => {
    const sign = m.weekly_pct > 0 ? '+' : '';
    return `<div class="weekly-mover-item">
      <span class="weekly-mover-ticker">${m.ticker}</span>
      <span class="weekly-mover-name">${m.name}</span>
      <span class="weekly-mover-pct ${cls}">${sign}${Number(m.weekly_pct).toFixed(2)}%</span>
    </div>`;
  }).join('');

  const signalList = items => items.map(t =>
    `<li class="weekly-list-item">${t}</li>`
  ).join('');

  el.innerHTML = `
    <div class="weekly-report-card">
      <div class="weekly-report-header">
        <div>
          <div class="weekly-report-label">End of Week Report</div>
          <h2 class="weekly-report-title">Week Ending ${wr.week_ending}</h2>
        </div>
        <div class="weekly-breadth">
          <span class="up">${wr.advancing} advancing</span>
          <span class="weekly-breadth-sep">/</span>
          <span class="down">${wr.declining} declining</span>
          <span class="weekly-breadth-total">of ${wr.total} REITs</span>
        </div>
      </div>
    </div>

    <div class="weekly-grid">
      <div class="section">
        <div class="section-header"><h2>Top Gainers \u2014 Week</h2></div>
        <div class="panel weekly-movers-panel">
          ${wr.top_gainers && wr.top_gainers.length ? moverRow(wr.top_gainers, 'up') : '<p class="empty-msg">No data.</p>'}
        </div>
      </div>
      <div class="section">
        <div class="section-header"><h2>Top Losers \u2014 Week</h2></div>
        <div class="panel weekly-movers-panel">
          ${wr.top_losers && wr.top_losers.length ? moverRow(wr.top_losers, 'down') : '<p class="empty-msg">No data.</p>'}
        </div>
      </div>
    </div>

    ${wr.key_signals && wr.key_signals.length ? `
    <div class="section">
      <div class="section-header"><h2>Key REIT Signals This Week</h2></div>
      <div class="panel">
        <ul class="weekly-list">${signalList(wr.key_signals)}</ul>
      </div>
    </div>` : ''}

    ${wr.broad_highlights && wr.broad_highlights.length ? `
    <div class="section">
      <div class="section-header"><h2>${cfg.sectorCatLabel} &amp; Macro Highlights</h2></div>
      <div class="panel">
        <ul class="weekly-list">${signalList(wr.broad_highlights)}</ul>
      </div>
    </div>` : ''}`;

  // Weekly PDF section at the bottom
  loadWeeklyPdfSection(el);
}

// ── Today's Brief ─────────────────────────────────────────────
function renderBrief(sData) {
  const stocks    = Object.values(sData.stocks);
  const news      = sData.news || [];
  const sorted    = [...stocks].sort((a, b) => b.pct_change - a.pct_change);
  const advancing = stocks.filter(s => s.pct_change > 0).length;
  const declining = stocks.filter(s => s.pct_change < 0).length;
  const cfg       = SECTOR_CONFIG[currentSector];

  const majority = advancing > declining ? 'up' : advancing < declining ? 'down' : 'flat';
  const sLabel   = cfg.sectorName;
  const sentimentText = majority === 'up'
    ? `${advancing} of ${stocks.length} ${sLabel} REITs advanced today`
    : majority === 'down'
    ? `${declining} of ${stocks.length} ${sLabel} REITs declined today`
    : `${sLabel.charAt(0).toUpperCase() + sLabel.slice(1)} REITs were mixed today`;
  const sentimentCls = majority === 'up' ? 'up' : majority === 'down' ? 'down' : 'flat';

  const gainers = sorted.filter(s => s.pct_change > 0).slice(0, 2);
  const losers  = sorted.filter(s => s.pct_change < 0).reverse().slice(0, 2);
  const movers  = [...gainers, ...losers].slice(0, 4);

  const signals = news.filter(n => n.is_signal).slice(0, 5);
  const macro   = news.filter(n => !n.ticker && n.category !== 'reit' && n.is_signal).slice(0, 3);

  const moverCards = movers.map(s => {
    const { text, cls } = fmtChange(s.pct_change);
    return `
      <div class="brief-mover">
        <div class="brief-mover-left">
          <span class="brief-ticker">${s.ticker}</span>
          <span class="brief-name">${s.name}</span>
        </div>
        <div class="brief-mover-right">
          <span class="brief-price">${fmtPrice(s.price)}</span>
          <span class="pct-pill ${cls}">${text}</span>
        </div>
      </div>`;
  }).join('');

  const signalItems = signals.map(n => {
    const link = n.link
      ? `<a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>`
      : n.title;
    const label = n.ticker || n.source || '\u2014';
    return `
      <div class="brief-item">
        <span class="brief-item-tag">${label}</span>
        <span class="brief-item-text">${link}</span>
      </div>`;
  }).join('');

  const macroItems = macro.map(n => {
    const link = n.link
      ? `<a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>`
      : n.title;
    return `
      <div class="brief-item">
        <span class="brief-item-tag broad">${n.source}</span>
        <span class="brief-item-text">${link}</span>
      </div>`;
  }).join('');

  document.getElementById('todaysBrief').innerHTML = `
    <div class="brief-wrap">

      <div class="brief-hero">
        <div class="brief-date">${sData.market_date || '\u2014'}</div>
        <h2 class="brief-headline">
          <span class="${sentimentCls}">${sentimentText}.</span>
        </h2>
        <div class="brief-breadth">
          <span class="up">${advancing} up</span>
          <span class="brief-sep">&middot;</span>
          <span class="down">${declining} down</span>
          <span class="brief-sep">&middot;</span>
          <span class="flat">${stocks.length - advancing - declining} flat</span>
        </div>
      </div>

      <div class="brief-sections">

        <div class="brief-section">
          <div class="brief-section-label">Biggest Movers</div>
          <div class="brief-movers">${moverCards || '<p class="empty-msg">No data.</p>'}</div>
        </div>

        ${signals.length ? `
        <div class="brief-section">
          <div class="brief-section-label">Key Signals</div>
          <div class="brief-list">${signalItems}</div>
        </div>` : ''}

        ${macro.length ? `
        <div class="brief-section">
          <div class="brief-section-label">${cfg.sectorCatLabel} &amp; Policy</div>
          <div class="brief-list">${macroItems}</div>
        </div>` : ''}

      </div>
    </div>`;
}

// ── Overview Render ───────────────────────────────────────────
function renderOverview(sData) {
  const sectorPerf = sData.sector_performance || {};
  const topGainers = sData.top_gainers || [];
  const topLosers  = sData.top_losers  || [];
  const narrative  = sData.narrative   || '';
  const news       = (sData.news || []).slice(0, 8);

  // Sector scorecard bars
  const sorted = Object.entries(sectorPerf).sort((a, b) => (b[1].avg_change || 0) - (a[1].avg_change || 0));
  const maxAbs = Math.max(...sorted.map(([, v]) => Math.abs(v.avg_change || 0)), 0.1);

  const scorecardRows = sorted.map(([key, v]) => {
    const pct     = v.avg_change || 0;
    const barPct  = Math.min(100, (Math.abs(pct) / maxAbs) * 100);
    const color   = pct >= 0 ? 'var(--green)' : 'var(--red)';
    const sign    = pct >= 0 ? '+' : '';
    const barDir  = pct >= 0 ? 'margin-left:50%' : `margin-left:${(50 - barPct/2).toFixed(1)}%`;
    return `<div class="overview-scorecard-row">
      <div class="overview-scorecard-name">${key.charAt(0).toUpperCase() + key.slice(1)}</div>
      <div class="overview-scorecard-track">
        <div class="overview-scorecard-bar" style="width:${(barPct/2).toFixed(1)}%;background:${color};${barDir}"></div>
      </div>
      <div class="overview-scorecard-pct" style="color:${color}">${sign}${pct.toFixed(2)}%</div>
    </div>`;
  }).join('');

  // Mover cards
  const moverCard = (s, cls) => {
    const { text } = fmtChange(s.pct_change);
    return `<div class="overview-mover-card ${cls}">
      <span class="overview-mover-ticker">${s.ticker}</span>
      <span class="overview-mover-name">${s.name || ''}</span>
      <span class="overview-mover-pct ${cls === 'gain' ? 'up' : 'down'}">${text}</span>
    </div>`;
  };

  // Headline items
  const headlineItems = news.map(n => {
    const link = n.link
      ? `<a href="${n.link}" target="_blank" rel="noopener">${n.title}</a>`
      : n.title;
    return `<div class="brief-item">
      <span class="brief-item-tag broad">${n.source || 'News'}</span>
      <span class="brief-item-text">${link}</span>
    </div>`;
  }).join('');

  document.getElementById('todaysBrief').innerHTML = `
    <div class="brief-wrap">

      <div class="brief-hero">
        <div class="brief-date">${sData.market_date || '\u2014'}</div>
        <h2 class="brief-headline">REIT Sector Overview</h2>
        <div class="brief-breadth" style="color:var(--t3)">All Sectors &nbsp;&middot;&nbsp; Daily Market Snapshot</div>
      </div>

      <div class="brief-sections">

        <div class="brief-section">
          <div class="brief-section-label">Sector Scorecard</div>
          <div class="overview-scorecard">${scorecardRows || '<p class="empty-msg">No data.</p>'}</div>
        </div>

        ${narrative ? `<div class="brief-section">
          <div class="brief-section-label">AI Market Brief</div>
          <div class="overview-narrative">${narrative}</div>
        </div>` : ''}

        <div class="brief-section">
          <div class="brief-section-label">Top Movers</div>
          <div class="overview-movers-grid">
            <div>
              <div class="overview-movers-label up">Top Gainers</div>
              ${topGainers.slice(0, 5).map(s => moverCard(s, 'gain')).join('') || '<p class="empty-msg">—</p>'}
            </div>
            <div>
              <div class="overview-movers-label down">Top Losers</div>
              ${topLosers.slice(0, 5).map(s => moverCard(s, 'loss')).join('') || '<p class="empty-msg">—</p>'}
            </div>
          </div>
        </div>

        ${news.length ? `<div class="brief-section">
          <div class="brief-section-label">Broad Headlines</div>
          <div class="brief-list">${headlineItems}</div>
        </div>` : ''}

      </div>
    </div>`;
}

// ── Sector Dropdown ───────────────────────────────────────────
const SECTOR_DISPLAY_NAMES = {
  overview: 'Overview',
  healthcare: 'Healthcare', housing: 'Residential', industrial: 'Industrial',
  retail: 'Retail / Mall', hospitality: 'Hospitality', netlease: 'Net Lease', tower: 'Tower', office: 'Office',
};

function initSectorDropdown() {
  const btn  = document.getElementById('sectorDropdownBtn');
  const menu = document.getElementById('sectorDropdownMenu');

  // Sync initial state
  document.getElementById('sectorDropdownLabel').textContent = SECTOR_DISPLAY_NAMES[currentSector] || currentSector;
  document.querySelectorAll('.sector-option').forEach(o => {
    o.classList.toggle('active', o.dataset.sector === currentSector);
  });

  btn.addEventListener('click', e => {
    e.stopPropagation();
    const opening = menu.classList.contains('hidden');
    menu.classList.toggle('hidden', !opening);
    btn.classList.toggle('open', opening);
  });

  document.querySelectorAll('.sector-option').forEach(li => {
    li.addEventListener('click', e => {
      e.stopPropagation();
      const key = li.dataset.sector;
      switchSector(key);
      menu.classList.add('hidden');
      btn.classList.remove('open');
    });
  });

  // Close on outside click
  document.addEventListener('click', () => {
    menu.classList.add('hidden');
    btn.classList.remove('open');
  });
}

// ── Sector Switcher ───────────────────────────────────────────
function switchSector(key) {
  if (!SECTOR_CONFIG[key]) return;
  currentSector = key;
  TRACKED       = new Set([SECTOR_CONFIG[key].focus]);
  localStorage.setItem('sector', key);

  const cfg = SECTOR_CONFIG[key];

  const sectorLabel = document.getElementById('subscribeForSector');
  if (sectorLabel) sectorLabel.textContent = SECTOR_DISPLAY_NAMES[key] || key;

  // Sync dropdown label + active option
  const labelEl = document.getElementById('sectorDropdownLabel');
  if (labelEl) labelEl.textContent = SECTOR_DISPLAY_NAMES[key] || key;
  document.querySelectorAll('.sector-option').forEach(o => {
    o.classList.toggle('active', o.dataset.sector === key);
  });

  document.getElementById('siteTitle').textContent        = cfg.label;
  document.getElementById('siteSubtitle').textContent     = cfg.subtitle;
  const focusTabBtn = document.getElementById('focusTabBtn');
  if (cfg.focus) {
    focusTabBtn.innerHTML = `${cfg.focus} <span class="tab-badge">Focus</span>`;
    focusTabBtn.classList.remove('hidden');
  } else {
    focusTabBtn.classList.add('hidden');
    if (focusTabBtn.classList.contains('active')) {
      focusTabBtn.classList.remove('active');
      document.getElementById('tab-focus').classList.add('hidden');
      document.querySelector('.tab-btn[data-tab="brief"]').classList.add('active');
      document.getElementById('tab-brief').classList.remove('hidden');
    }
  }
  document.getElementById('sectorNewsTabBtn').textContent = cfg.newsTabLabel;
  document.getElementById('sectorCatBtn').textContent     = cfg.sectorCatLabel;
  document.getElementById('focusNewsHeader').textContent  = cfg.focus ? `${cfg.focus} News` : 'Focus News';
  document.getElementById('coverageNote').textContent     = cfg.coverageNote;
  document.title = cfg.label;

  // Reset filter state
  sortState = { col: 'pct_change', dir: 'desc' };
  sectorCat = 'all';
  document.querySelectorAll('#sectorCatFilters .cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.hcat === 'all');
  });

  const sData = window._data && window._data.sectors && window._data.sectors[key];
  if (!sData) return;

  // Inject market_date so render functions can access it
  if (!sData.market_date) sData.market_date = window._data.market_date;

  renderAlert(sData.stocks);
  if (key === 'overview') {
    renderOverview(sData);
  } else {
    renderBrief(sData);
  }
  renderFocusSummary(sData);
  renderFocus(sData);
  renderREITsSummary(sData);
  renderMovers(sData.stocks);
  renderTable(sData.stocks);
  renderSectorSummary(sData);
  renderSectorNewsTab(sData.news || []);
  renderWeeklyReport(sData);
  if (window._onSectorChange) window._onSectorChange(key);
}

// ── Subscribe Form ────────────────────────────────────────────
function initSubscribeForm() {
  const form    = document.getElementById('subscribeForm');
  const input   = document.getElementById('subscribeEmail');
  const btn     = document.getElementById('subscribeBtn');
  const success = document.getElementById('subscribeSuccess');
  const error   = document.getElementById('subscribeError');

  if (!form) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const email = input.value.trim();
    if (!email) return;

    if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      error.textContent = 'Subscription not configured yet — check back after next workflow run.';
      error.classList.remove('hidden');
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Subscribing…';
    error.classList.add('hidden');

    try {
      const resp = await fetch(`${window.SUPABASE_URL}/rest/v1/subscribers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': window.SUPABASE_ANON_KEY,
          'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({ email, sector: currentSector }),
      });

      if (resp.ok) {
        form.classList.add('hidden');
        const label = SECTOR_DISPLAY_NAMES[currentSector] || currentSector;
        success.textContent = `✓ Subscribed — you'll receive the ${label} brief at around 4:30 PM ET weekdays.`;
        success.classList.remove('hidden');
        fetch(`${window.SUPABASE_URL}/functions/v1/send-welcome`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ email, sector: currentSector }),
        }).catch(() => {});
      } else if (resp.status === 409) {
        form.classList.add('hidden');
        success.textContent = '✓ You\'re already subscribed.';
        success.classList.remove('hidden');
      } else {
        throw new Error(`${resp.status}`);
      }
    } catch (err) {
      btn.disabled = false;
      btn.textContent = 'Subscribe';
      error.textContent = 'Something went wrong — please try again.';
      error.classList.remove('hidden');
    }
  });
}

// ── Unsubscribe ───────────────────────────────────────────────
async function handleUnsubscribe() {
  const token = new URLSearchParams(location.search).get('unsub');
  if (!token || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) return;

  try {
    await fetch(`${window.SUPABASE_URL}/rest/v1/rpc/unsubscribe_by_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': window.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${window.SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ p_token: token }),
    });
  } catch(_) {}

  const bar = document.getElementById('subscribeBar');
  if (bar) bar.innerHTML = '<div class="subscribe-inner"><p style="color:var(--t3);font-size:13px">✓ You\'ve been unsubscribed.</p></div>';
}

// ── Bootstrap ────────────────────────────────────────────────
async function init() {
  try {
    const res  = await fetch('data/market_data.json?t=' + Date.now());
    const data = await res.json();
    window._data = data;

    document.getElementById('marketDate').textContent = data.market_date || '\u2014';
    try {
      const d = new Date(data.last_updated);
      document.getElementById('lastUpdated').textContent = data.last_updated
        ? 'Updated: ' + d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short' })
        : 'No data yet \u2014 workflow runs at 5:30 PM ET weekdays.';
    } catch(e) {
      document.getElementById('lastUpdated').textContent = 'No data yet \u2014 workflow runs at 5:30 PM ET weekdays.';
    }

    if (!data.sectors) {
      document.getElementById('lastUpdated').textContent = 'No data yet \u2014 workflow runs at 5:30 PM ET weekdays.';
      return;
    }

    // Set up sector dropdown
    initSectorDropdown();

    // Initial render
    switchSector(currentSector);

    initTabs();
    attachTableSort();
    initSectorCatFilters();
    initSubscribeForm();
    handleUnsubscribe();
    initPdfTab();

  } catch (err) {
    console.error(err);
    document.getElementById('lastUpdated').textContent = 'Error loading data.';
  }
}

init();

// ── Weekly PDF Section ────────────────────────────────────────
let weeklyPdfArchivePage   = 1;
let weeklyPdfArchiveList   = [];
let weeklyPdfArchiveOpen   = false;
let weeklyPdfSelectedUrls  = new Set();
let weeklyPdfCurrentLabel  = '';

async function listWeeklyPdfs(sector) {
  const base  = pdfStorageBase();
  const today = new Date();
  const checks = [];
  // Check every Friday for the past 16 weeks (~4 months)
  for (let i = 0; i < 16; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i * 7);
    // Find the most recent Friday on or before d
    const dayOfWeek = d.getDay(); // 0=Sun … 5=Fri
    d.setDate(d.getDate() - ((dayOfWeek + 2) % 7 === 0 ? 0 : (dayOfWeek - 5 + 7) % 7));
    const dateStr = d.toISOString().split('T')[0];
    const url = `${base}/${sector}/weekly/${dateStr}.pdf`;
    checks.push(
      fetch(url, { method: 'HEAD' })
        .then(res => res.ok ? { name: `${dateStr}.pdf`, date: dateStr, url } : null)
        .catch(() => null)
    );
  }
  const results = await Promise.all(checks);
  // Deduplicate by date, keep newest first
  const seen = new Set();
  return results.filter(r => r && !seen.has(r.date) && seen.add(r.date));
}

function renderWeeklyPdfArchive() {
  const wrap  = document.getElementById('weeklyPdfArchiveDropdown');
  if (!wrap) return;
  const total = weeklyPdfArchiveList.length;
  const pages = Math.max(1, Math.ceil(total / PDF_PAGE_SIZE));
  const start = (weeklyPdfArchivePage - 1) * PDF_PAGE_SIZE;
  const slice = weeklyPdfArchiveList.slice(start, start + PDF_PAGE_SIZE);

  if (!total) {
    wrap.innerHTML = '<p class="section-note" style="padding:16px">No archived weekly reports yet.</p>';
    return;
  }

  const pageUrls   = slice.map(f => f.url);
  const allChecked = pageUrls.every(u => weeklyPdfSelectedUrls.has(u));
  const anySelected = weeklyPdfSelectedUrls.size > 0;

  const rows = slice.map(f => `
    <label class="pdf-archive-row">
      <input type="checkbox" class="weekly-pdf-cb" data-url="${f.url}" data-label="${weeklyPdfCurrentLabel}" data-date="${f.date}" ${weeklyPdfSelectedUrls.has(f.url) ? 'checked' : ''}>
      <span class="pdf-archive-date">${f.date}</span>
      <a class="pdf-archive-dl" href="${f.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Open ↗</a>
    </label>`).join('');

  wrap.innerHTML = `
    <div class="pdf-archive-toolbar">
      <label class="pdf-select-all">
        <input type="checkbox" id="weeklyPdfSelectAll" ${allChecked ? 'checked' : ''}>
        <span>Select all on page</span>
      </label>
      ${anySelected ? `<button class="btn-primary pdf-dl-btn" id="weeklyPdfDownloadBtn">Download selected (${weeklyPdfSelectedUrls.size})</button>` : ''}
    </div>
    <div class="pdf-archive-list">${rows}</div>
    <div class="pdf-pager">
      <button class="pdf-pager-btn" id="weeklyPdfPrevBtn" ${weeklyPdfArchivePage === 1 ? 'disabled' : ''}>← Prev</button>
      <span class="pdf-pager-info">Page ${weeklyPdfArchivePage} / ${pages}</span>
      <button class="pdf-pager-btn" id="weeklyPdfNextBtn" ${weeklyPdfArchivePage === pages ? 'disabled' : ''}>Next →</button>
    </div>`;

  wrap.querySelectorAll('.weekly-pdf-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.checked ? weeklyPdfSelectedUrls.add(cb.dataset.url) : weeklyPdfSelectedUrls.delete(cb.dataset.url);
      renderWeeklyPdfArchive();
    });
  });
  document.getElementById('weeklyPdfSelectAll').addEventListener('change', e => {
    pageUrls.forEach(u => e.target.checked ? weeklyPdfSelectedUrls.add(u) : weeklyPdfSelectedUrls.delete(u));
    renderWeeklyPdfArchive();
  });
  document.getElementById('weeklyPdfDownloadBtn')?.addEventListener('click', () => {
    weeklyPdfSelectedUrls.forEach(url => {
      const a = document.createElement('a');
      a.href = url; a.download = url.split('/').pop(); a.target = '_blank';
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    });
  });
  document.getElementById('weeklyPdfPrevBtn').addEventListener('click', () => {
    if (weeklyPdfArchivePage > 1) { weeklyPdfArchivePage--; renderWeeklyPdfArchive(); }
  });
  document.getElementById('weeklyPdfNextBtn').addEventListener('click', () => {
    if (weeklyPdfArchivePage < pages) { weeklyPdfArchivePage++; renderWeeklyPdfArchive(); }
  });
}

async function loadWeeklyPdfSection(containerEl) {
  weeklyPdfArchivePage  = 1;
  weeklyPdfArchiveList  = [];
  weeklyPdfArchiveOpen  = false;
  weeklyPdfSelectedUrls = new Set();
  weeklyPdfCurrentLabel = (SECTOR_DISPLAY_NAMES[currentSector] || currentSector) + ' Weekly';

  const section = document.createElement('div');
  section.className = 'section';
  section.innerHTML = `
    <div class="section-header"><h2>Weekly PDF Report</h2></div>
    <div id="weeklyPdfTodayWrap"><div class="loading-msg">Loading weekly PDF…</div></div>
    <div id="weeklyPdfArchiveSection"></div>`;
  containerEl.appendChild(section);

  const files = await listWeeklyPdfs(currentSector);
  const todayWrap  = document.getElementById('weeklyPdfTodayWrap');
  const archiveEl  = document.getElementById('weeklyPdfArchiveSection');

  if (!files.length) {
    todayWrap.innerHTML = '<p class="section-note">No weekly PDF reports yet — they generate after market close on Fridays when weekly data is available.</p>';
    return;
  }

  const latest = files[0];
  todayWrap.innerHTML = `
    <div class="pdf-viewer-wrap">
      <div class="pdf-viewer-actions">
        <a class="btn-primary" href="${latest.url}" target="_blank" rel="noopener">Open PDF ↗</a>
        <a class="btn-secondary" href="${latest.url}" download="${weeklyPdfCurrentLabel} ${latest.date}.pdf">Download ↓</a>
      </div>
      <iframe class="pdf-iframe" src="${latest.url}" title="REIT Weekly Report ${latest.date}"></iframe>
    </div>`;

  weeklyPdfArchiveList = files.slice(1);
  if (weeklyPdfArchiveList.length) {
    archiveEl.innerHTML = `
      <button class="pdf-archive-toggle-btn" id="weeklyPdfArchiveToggleBtn">Archive ▼</button>
      <div class="pdf-archive-dropdown hidden" id="weeklyPdfArchiveDropdown"></div>`;
    document.getElementById('weeklyPdfArchiveToggleBtn').addEventListener('click', () => {
      weeklyPdfArchiveOpen = !weeklyPdfArchiveOpen;
      const dropdown = document.getElementById('weeklyPdfArchiveDropdown');
      const btn      = document.getElementById('weeklyPdfArchiveToggleBtn');
      if (weeklyPdfArchiveOpen) {
        dropdown.classList.remove('hidden');
        btn.textContent = 'Archive ▲';
        renderWeeklyPdfArchive();
      } else {
        dropdown.classList.add('hidden');
        btn.textContent = 'Archive ▼';
      }
    });
  }
}

// ── PDF Report Tab ────────────────────────────────────────────
const PDF_PAGE_SIZE  = 10;
let pdfArchivePage   = 1;
let pdfArchiveList   = [];
let pdfArchiveOpen   = false;
let pdfSelectedUrls  = new Set();
let pdfCurrentLabel  = '';

function pdfStorageBase() {
  return `${window.SUPABASE_URL}/storage/v1/object/public/sector-reports`;
}

async function listSectorPdfs(sector) {
  const base  = pdfStorageBase();
  const today = new Date();
  const checks = [];
  // Check the last 30 calendar days
  for (let i = 0; i < 30; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const url = `${base}/${sector}/${dateStr}.pdf`;
    checks.push(
      fetch(url, { method: 'HEAD' })
        .then(res => res.ok ? { name: `${dateStr}.pdf`, date: dateStr, url } : null)
        .catch(() => null)
    );
  }
  const results = await Promise.all(checks);
  return results.filter(Boolean); // newest first (i=0 is today)
}

function downloadSelected() {
  // Build url→filename map from checked checkboxes (both daily and weekly)
  const nameMap = {};
  document.querySelectorAll('.pdf-cb[data-label], .weekly-pdf-cb[data-label]').forEach(cb => {
    if (cb.dataset.label && cb.dataset.date) {
      nameMap[cb.dataset.url] = `${cb.dataset.label} ${cb.dataset.date}.pdf`;
    }
  });
  const allUrls = new Set([...pdfSelectedUrls, ...weeklyPdfSelectedUrls]);
  allUrls.forEach(url => {
    const a = document.createElement('a');
    a.href = url;
    a.download = nameMap[url] || url.split('/').pop();
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  });
}

function renderPdfArchiveDropdown() {
  const wrap  = document.getElementById('pdfArchiveDropdown');
  const total = pdfArchiveList.length;
  const pages = Math.max(1, Math.ceil(total / PDF_PAGE_SIZE));
  const start = (pdfArchivePage - 1) * PDF_PAGE_SIZE;
  const slice = pdfArchiveList.slice(start, start + PDF_PAGE_SIZE);

  if (!total) {
    wrap.innerHTML = '<p class="section-note" style="padding:16px">No archived reports yet — check back after the next daily run.</p>';
    return;
  }

  const pageUrls    = slice.map(f => f.url);
  const allChecked  = pageUrls.every(u => pdfSelectedUrls.has(u));
  const anySelected = pdfSelectedUrls.size > 0;

  const rows = slice.map(f => `
    <label class="pdf-archive-row">
      <input type="checkbox" class="pdf-cb" data-url="${f.url}" data-label="${pdfCurrentLabel}" data-date="${f.date}" ${pdfSelectedUrls.has(f.url) ? 'checked' : ''}>
      <span class="pdf-archive-date">${f.date}</span>
      <a class="pdf-archive-dl" href="${f.url}" target="_blank" rel="noopener" onclick="event.stopPropagation()">Open ↗</a>
    </label>`).join('');

  wrap.innerHTML = `
    <div class="pdf-archive-toolbar">
      <label class="pdf-select-all">
        <input type="checkbox" id="pdfSelectAll" ${allChecked ? 'checked' : ''}>
        <span>Select all on page</span>
      </label>
      ${anySelected ? `<button class="btn-primary pdf-dl-btn" id="pdfDownloadBtn">Download selected (${pdfSelectedUrls.size})</button>` : ''}
    </div>
    <div class="pdf-archive-list">${rows}</div>
    <div class="pdf-pager">
      <button class="pdf-pager-btn" id="pdfPrevBtn" ${pdfArchivePage === 1 ? 'disabled' : ''}>← Prev</button>
      <span class="pdf-pager-info">Page ${pdfArchivePage} / ${pages}</span>
      <button class="pdf-pager-btn" id="pdfNextBtn" ${pdfArchivePage === pages ? 'disabled' : ''}>Next →</button>
    </div>`;

  // Checkboxes
  wrap.querySelectorAll('.pdf-cb').forEach(cb => {
    cb.addEventListener('change', () => {
      cb.checked ? pdfSelectedUrls.add(cb.dataset.url) : pdfSelectedUrls.delete(cb.dataset.url);
      renderPdfArchiveDropdown();
    });
  });

  document.getElementById('pdfSelectAll').addEventListener('change', e => {
    pageUrls.forEach(u => e.target.checked ? pdfSelectedUrls.add(u) : pdfSelectedUrls.delete(u));
    renderPdfArchiveDropdown();
  });

  document.getElementById('pdfDownloadBtn')?.addEventListener('click', downloadSelected);

  document.getElementById('pdfPrevBtn').addEventListener('click', () => {
    if (pdfArchivePage > 1) { pdfArchivePage--; renderPdfArchiveDropdown(); }
  });
  document.getElementById('pdfNextBtn').addEventListener('click', () => {
    if (pdfArchivePage < pages) { pdfArchivePage++; renderPdfArchiveDropdown(); }
  });
}

function toggleArchive() {
  pdfArchiveOpen = !pdfArchiveOpen;
  const dropdown = document.getElementById('pdfArchiveDropdown');
  const btn      = document.getElementById('pdfArchiveToggleBtn');
  if (pdfArchiveOpen) {
    dropdown.classList.remove('hidden');
    btn.textContent = 'Archive ▲';
    renderPdfArchiveDropdown();
  } else {
    dropdown.classList.add('hidden');
    btn.textContent = 'Archive ▼';
  }
}

async function loadPdfTab(sector) {
  const todayWrap = document.getElementById('pdfTodayWrap');
  const titleEl   = document.getElementById('pdfReportTitle');
  const dateEl    = document.getElementById('pdfReportDate');
  const archiveEl = document.getElementById('pdfArchiveSection');
  const label     = SECTOR_DISPLAY_NAMES[sector] || sector;

  // Reset state
  pdfArchiveOpen  = false;
  pdfArchivePage  = 1;
  pdfSelectedUrls = new Set();
  pdfCurrentLabel = label;

  titleEl.textContent = `${label} — Today's Sector Report`;
  todayWrap.innerHTML = '<div class="loading-msg">Loading PDF…</div>';
  archiveEl.innerHTML = '';

  const files = await listSectorPdfs(sector);

  if (!files.length) {
    todayWrap.innerHTML = '<p class="section-note">No PDF reports yet — they generate daily after market close.</p>';
    return;
  }

  // Today's PDF
  const today = files[0];
  dateEl.textContent = today.date;
  todayWrap.innerHTML = `
    <div class="pdf-viewer-wrap">
      <div class="pdf-viewer-actions">
        <a class="btn-primary" href="${today.url}" target="_blank" rel="noopener">Open PDF ↗</a>
        <a class="btn-secondary" href="${today.url}" download="${label} ${today.date}.pdf">Download ↓</a>
      </div>
      <iframe class="pdf-iframe" src="${today.url}" title="${label} Sector Report ${today.date}"></iframe>
    </div>`;

  // Archive toggle — only show if there are past reports
  pdfArchiveList = files.slice(1);
  if (pdfArchiveList.length) {
    archiveEl.innerHTML = `
      <button class="pdf-archive-toggle-btn" id="pdfArchiveToggleBtn">Archive ▼</button>
      <div class="pdf-archive-dropdown hidden" id="pdfArchiveDropdown"></div>`;
    document.getElementById('pdfArchiveToggleBtn').addEventListener('click', toggleArchive);
  }
}

function initPdfTab() {
  document.querySelectorAll('.tab-btn').forEach(btn => {
    if (btn.dataset.tab === 'pdf-report') {
      btn.addEventListener('click', () => loadPdfTab(currentSector));
    }
  });
  window._onSectorChange = (key) => {
    const activeTab = document.querySelector('.tab-btn.active');
    if (activeTab && activeTab.dataset.tab === 'pdf-report') loadPdfTab(key);
  };
}

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
let currentSector = localStorage.getItem('sector') || 'healthcare';
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

// ── Sector Dropdown ───────────────────────────────────────────
const SECTOR_DISPLAY_NAMES = {
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
  renderBrief(sData);
  renderFocusSummary(sData);
  renderFocus(sData);
  renderREITsSummary(sData);
  renderMovers(sData.stocks);
  renderTable(sData.stocks);
  renderSectorSummary(sData);
  renderSectorNewsTab(sData.news || []);
  renderWeeklyReport(sData);
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

  } catch (err) {
    console.error(err);
    document.getElementById('lastUpdated').textContent = 'Error loading data.';
  }
}

init();

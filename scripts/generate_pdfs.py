"""
REIT Sector PDF Report Generator
Generates one PDF per sector from market_data.json and uploads to Supabase Storage.
Runs after fetch_data.py in GitHub Actions.
"""
import json, os, sys, io, requests
from datetime import datetime, timezone

SUPABASE_URL     = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE = os.environ.get('SUPABASE_SERVICE_KEY', '')
BUCKET           = 'sector-reports'

SECTOR_LABELS = {
    'overview':    'Overview',
    'healthcare':  'Healthcare',
    'housing':     'Residential',
    'industrial':  'Industrial',
    'retail':      'Retail / Mall',
    'hospitality': 'Hospitality',
    'netlease':    'Net Lease',
    'tower':       'Tower',
    'office':      'Office',
}

# ── Colours ───────────────────────────────────────────────────
C_BG       = (10/255,  11/255,  13/255)   # #0a0b0d
C_ACCENT   = (0/255,   82/255, 255/255)   # #0052ff
C_UP       = (0/255,  192/255, 135/255)   # #00c087
C_DOWN     = (246/255, 70/255,  93/255)   # #f6465d
C_WHITE    = (1, 1, 1)
C_LIGHT    = (0.96, 0.97, 0.98)
C_BORDER   = (0.92, 0.93, 0.95)
C_TEXT     = (0.18, 0.20, 0.25)
C_MUTED    = (0.42, 0.44, 0.50)


def fp(v):
    return f'${float(v):.2f}' if v else '—'

def fpct(v):
    if v is None: return '—'
    sign = '+' if v > 0 else ''
    return f'{sign}{float(v):.2f}%'

def fcap(v):
    if not v: return '—'
    if v >= 1e12: return f'${v/1e12:.1f}T'
    if v >= 1e9:  return f'${v/1e9:.1f}B'
    return f'${v/1e6:.0f}M'


def generate_pdf(sector_key, sdata, market_date):
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import Color, HexColor

    label   = SECTOR_LABELS.get(sector_key, sector_key.title())
    stocks  = sdata.get('stocks', {})
    news    = sdata.get('news', [])
    fd      = sdata.get('focus_details') or {}
    focus   = sdata.get('focus_ticker', '')

    vals      = list(stocks.values())
    advancing = sum(1 for s in vals if (s.get('pct_change') or 0) > 0)
    declining = sum(1 for s in vals if (s.get('pct_change') or 0) < 0)
    unchanged = len(vals) - advancing - declining

    sorted_s  = sorted(vals, key=lambda s: s.get('pct_change') or 0, reverse=True)
    top3      = [s for s in sorted_s if (s.get('pct_change') or 0) > 0][:3]
    bot3      = [s for s in reversed(sorted_s) if (s.get('pct_change') or 0) < 0][:3]
    movers    = top3 + bot3
    signals   = [n for n in news if n.get('is_signal')][:8]

    buf = io.BytesIO()
    W, H = letter
    c = canvas.Canvas(buf, pagesize=letter)

    def rgb(t): return Color(t[0], t[1], t[2])

    # ── Header bar ────────────────────────────────────────────
    c.setFillColor(rgb(C_BG))
    c.rect(0, H - 1.4*inch, W, 1.4*inch, fill=1, stroke=0)

    c.setFillColor(rgb(C_ACCENT))
    c.setFont('Helvetica-Bold', 8)
    c.drawString(0.5*inch, H - 0.45*inch, 'REIT DASHBOARD  ·  DAILY SECTOR REPORT')

    c.setFillColor(rgb(C_WHITE))
    c.setFont('Helvetica-Bold', 22)
    c.drawString(0.5*inch, H - 0.82*inch, f'{label} REIT Sector Report')

    c.setFillColor(rgb(C_MUTED))
    c.setFont('Helvetica', 10)
    c.drawString(0.5*inch, H - 1.05*inch, f'Market date: {market_date}  ·  Generated {datetime.now(timezone.utc).strftime("%B %d, %Y")}')

    c.setFillColor(rgb(C_ACCENT))
    c.rect(0, H - 1.42*inch, W, 0.04*inch, fill=1, stroke=0)

    y = H - 1.7*inch

    # ── Market summary strip ──────────────────────────────────
    c.setFillColor(rgb(C_LIGHT))
    c.roundRect(0.5*inch, y - 0.55*inch, W - inch, 0.65*inch, 6, fill=1, stroke=0)

    bc = C_UP if advancing >= declining else C_DOWN
    c.setFillColor(rgb(bc))
    c.setFont('Helvetica-Bold', 14)
    c.drawString(0.75*inch, y - 0.22*inch, f'{advancing} Advancing')

    c.setFillColor(rgb(C_DOWN))
    c.drawString(0.75*inch + 1.6*inch, y - 0.22*inch, f'{declining} Declining')

    c.setFillColor(rgb(C_MUTED))
    c.setFont('Helvetica', 10)
    c.drawString(0.75*inch + 3.2*inch, y - 0.22*inch, f'{unchanged} Unchanged  ·  {len(vals)} total in universe')

    y -= 0.8*inch

    # ── Today's Movers ────────────────────────────────────────
    c.setFillColor(rgb(C_TEXT))
    c.setFont('Helvetica-Bold', 13)
    c.drawString(0.5*inch, y, "Today's Movers")
    y -= 0.08*inch

    c.setFillColor(rgb(C_ACCENT))
    c.rect(0.5*inch, y, 1.5*inch, 0.025*inch, fill=1, stroke=0)
    y -= 0.28*inch

    # Table header
    c.setFillColor(rgb(C_LIGHT))
    c.rect(0.5*inch, y - 0.05*inch, W - inch, 0.28*inch, fill=1, stroke=0)
    c.setFillColor(rgb(C_MUTED))
    c.setFont('Helvetica-Bold', 8)
    cols = [0.5, 1.1, 3.8, 5.2, 6.3]
    headers = ['TICKER', 'COMPANY', 'PRICE', 'DAY %', 'MKT CAP']
    for i, h in enumerate(headers):
        c.drawString((cols[i])*inch, y + 0.06*inch, h)
    y -= 0.05*inch

    # Table rows
    for idx, s in enumerate(movers):
        pct = s.get('pct_change') or 0
        row_bg = (1, 1, 1) if idx % 2 == 0 else C_LIGHT
        c.setFillColor(rgb(row_bg))
        c.rect(0.5*inch, y - 0.12*inch, W - inch, 0.32*inch, fill=1, stroke=0)

        c.setFillColor(rgb(C_ACCENT))
        c.setFont('Helvetica-Bold', 9)
        c.drawString(cols[0]*inch, y + 0.06*inch, s.get('ticker', ''))

        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica', 9)
        name = s.get('name', '')
        if len(name) > 30: name = name[:28] + '…'
        c.drawString(cols[1]*inch, y + 0.06*inch, name)
        c.drawString(cols[2]*inch, y + 0.06*inch, fp(s.get('price')))

        pct_color = C_UP if pct > 0 else C_DOWN if pct < 0 else C_MUTED
        c.setFillColor(rgb(pct_color))
        c.setFont('Helvetica-Bold', 9)
        c.drawString(cols[3]*inch, y + 0.06*inch, fpct(pct))

        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica', 9)
        c.drawString(cols[4]*inch, y + 0.06*inch, fcap(s.get('market_cap')))

        y -= 0.3*inch

    y -= 0.2*inch

    # ── Focus stock ───────────────────────────────────────────
    if focus and fd and stocks.get(focus):
        fs = stocks[focus]
        fp_pct = fs.get('pct_change') or 0

        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 13)
        c.drawString(0.5*inch, y, f'Focus Stock: {focus}')
        y -= 0.08*inch
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y, 1.8*inch, 0.025*inch, fill=1, stroke=0)
        y -= 0.28*inch

        c.setFillColor(rgb(C_LIGHT))
        box_h = 1.1*inch
        c.roundRect(0.5*inch, y - box_h + 0.2*inch, W - inch, box_h, 6, fill=1, stroke=0)

        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 12)
        c.drawString(0.75*inch, y + 0.02*inch, fd.get('name', focus))

        c.setFillColor(rgb(C_MUTED))
        c.setFont('Helvetica', 9)
        c.drawString(0.75*inch, y - 0.2*inch, fd.get('sector', ''))

        pct_color = C_UP if fp_pct > 0 else C_DOWN if fp_pct < 0 else C_MUTED
        c.setFillColor(rgb(pct_color))
        c.setFont('Helvetica-Bold', 14)
        price_x = W - 1.5*inch
        c.drawRightString(price_x, y + 0.02*inch, fp(fs.get('price')))
        c.setFont('Helvetica-Bold', 10)
        c.drawRightString(price_x, y - 0.2*inch, fpct(fp_pct) + ' today')

        thesis = fd.get('thesis_points', [])[:2]
        ty = y - 0.45*inch
        for pt in thesis:
            c.setFillColor(rgb(C_ACCENT))
            c.rect(0.75*inch, ty + 0.03*inch, 0.03*inch, 0.1*inch, fill=1, stroke=0)
            c.setFillColor(rgb(C_TEXT))
            c.setFont('Helvetica', 8)
            txt = pt if len(pt) <= 90 else pt[:88] + '…'
            c.drawString(0.85*inch, ty + 0.04*inch, txt)
            ty -= 0.18*inch

        y -= box_h + 0.2*inch

    # ── Key Signals ───────────────────────────────────────────
    if signals:
        if y < 2.5*inch:
            c.showPage()
            y = H - inch

        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 13)
        c.drawString(0.5*inch, y, 'Key Signals & News')
        y -= 0.08*inch
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y, 1.6*inch, 0.025*inch, fill=1, stroke=0)
        y -= 0.28*inch

        for n in signals:
            if y < inch:
                c.showPage()
                y = H - inch
            src = n.get('ticker') or n.get('source', '')
            title = n.get('title', '')
            if len(title) > 80: title = title[:78] + '…'

            c.setFillColor(rgb(C_ACCENT))
            c.setFont('Helvetica-Bold', 8)
            c.drawString(0.5*inch, y, f'[{src}]')
            c.setFillColor(rgb(C_TEXT))
            c.setFont('Helvetica', 9)
            c.drawString(0.5*inch + 0.7*inch, y, title)

            c.setFillColor(rgb(C_BORDER))
            c.rect(0.5*inch, y - 0.08*inch, W - inch, 0.01*inch, fill=1, stroke=0)
            y -= 0.28*inch

    # ── Footer ────────────────────────────────────────────────
    c.setFillColor(rgb(C_BG))
    c.rect(0, 0, W, 0.5*inch, fill=1, stroke=0)
    c.setFillColor(rgb(C_MUTED))
    c.setFont('Helvetica', 8)
    c.drawString(0.5*inch, 0.18*inch, 'Not investment advice  ·  Data via yfinance & public feeds  ·  REIT Dashboard')
    c.drawRightString(W - 0.5*inch, 0.18*inch, market_date)

    c.save()
    buf.seek(0)
    return buf.read()


def _render_overview_pdf(buf, sdata, market_date, total_pages):
    """
    Renders the overview PDF into buf.
    total_pages: used for 'Page X of Y' in footers; pass 0 on a count-only pass.
    Returns the number of pages actually rendered.
    """
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import Color
    from reportlab.lib.utils import ImageReader

    sector_perf = sdata.get('sector_performance', {})
    top_gainers = sdata.get('top_gainers', [])
    top_losers  = sdata.get('top_losers', [])
    narrative   = sdata.get('narrative', '')
    news        = sdata.get('news', [])

    W, H = letter
    c = canvas.Canvas(buf, pagesize=letter)
    current_page = [1]

    def rgb(t): return Color(t[0], t[1], t[2])

    def draw_footer(pg):
        c.setFillColor(rgb(C_BG))
        c.rect(0, 0, W, 0.5*inch, fill=1, stroke=0)
        c.setFillColor(rgb(C_MUTED))
        c.setFont('Helvetica', 8)
        c.drawString(0.5*inch, 0.18*inch,
                     'Not investment advice  ·  Data via yfinance & public feeds  ·  REIT Dashboard')
        if total_pages > 0:
            c.drawCentredString(W / 2, 0.18*inch, f'Page {pg} of {total_pages}')
        c.drawRightString(W - 0.5*inch, 0.18*inch, market_date)

    def advance_page():
        draw_footer(current_page[0])
        c.showPage()
        current_page[0] += 1

    # ── PAGE 1 ────────────────────────────────────────────────────

    # Header bar
    c.setFillColor(rgb(C_BG))
    c.rect(0, H - 1.4*inch, W, 1.4*inch, fill=1, stroke=0)

    c.setFillColor(rgb(C_ACCENT))
    c.setFont('Helvetica-Bold', 8)
    c.drawString(0.5*inch, H - 0.45*inch, 'REIT DASHBOARD  ·  DAILY SECTOR REPORT')

    c.setFillColor(rgb(C_WHITE))
    c.setFont('Helvetica-Bold', 22)
    c.drawString(0.5*inch, H - 0.82*inch, 'REIT SECTOR OVERVIEW — DAILY REPORT')

    c.setFillColor(rgb(C_MUTED))
    c.setFont('Helvetica', 10)
    c.drawString(0.5*inch, H - 1.05*inch,
                 f'Market date: {market_date}  ·  Generated {datetime.now(timezone.utc).strftime("%B %d, %Y")}')

    c.setFillColor(rgb(C_ACCENT))
    c.rect(0, H - 1.42*inch, W, 0.04*inch, fill=1, stroke=0)

    y = H - 1.7*inch

    # ── Sector Scorecard bar chart ────────────────────────────────
    if sector_perf:
        sorted_sectors = sorted(sector_perf.items(), key=lambda x: x[1]['avg_change'])
        names  = [k.title() for k, _ in sorted_sectors]
        values = [v['avg_change'] for _, v in sorted_sectors]
        colors = ['#00c087' if v >= 0 else '#f6465d' for v in values]

        fig, ax = plt.subplots(figsize=(6.8, max(3.0, len(names) * 0.45)))
        fig.patch.set_facecolor('white')
        ax.set_facecolor('white')
        bars = ax.barh(names, values, color=colors, height=0.55, zorder=3)
        ax.axvline(0, color='#9ca3af', linewidth=1.0, zorder=2)
        ax.set_xlabel('Avg % Change (Day)', fontsize=9, color='#6b7280', labelpad=8)
        ax.tick_params(axis='y', labelsize=9, colors='#1a1d23', pad=6)
        ax.tick_params(axis='x', labelsize=8, colors='#6b7280')
        ax.set_xlim(min(values) * 1.35 if min(values) < 0 else -0.3,
                    max(values) * 1.35 if max(values) > 0 else 0.3)
        ax.xaxis.set_major_formatter(plt.FuncFormatter(lambda x, _: f'{x:+.1f}%'))
        ax.grid(axis='x', color='#f0f0f0', linewidth=0.6, zorder=1)
        ax.spines[['top', 'right', 'left']].set_visible(False)
        ax.spines['bottom'].set_color('#e5e7eb')
        for bar, val in zip(bars, values):
            label = f'{val:+.2f}%'
            pad   = abs(max(values) - min(values)) * 0.03
            xpos  = val + pad if val >= 0 else val - pad
            ha    = 'left' if val >= 0 else 'right'
            ax.text(xpos, bar.get_y() + bar.get_height()/2, label,
                    va='center', ha=ha, fontsize=8, color='#111827',
                    fontweight='bold')
        plt.tight_layout(pad=0.8)

        chart_buf = io.BytesIO()
        plt.savefig(chart_buf, format='png', dpi=150, bbox_inches='tight')
        plt.close(fig)
        chart_buf.seek(0)

        chart_h = 2.0*inch
        chart_w = W - inch
        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 13)
        c.drawString(0.5*inch, y, 'Sector Scorecard')
        y -= 0.08*inch
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y, 1.4*inch, 0.025*inch, fill=1, stroke=0)
        y -= 0.2*inch
        c.drawImage(ImageReader(chart_buf), 0.5*inch, y - chart_h, width=chart_w, height=chart_h)
        y -= chart_h + 0.3*inch

    # ── Top Gainers / Losers — full-width stacked tables ─────────
    COL_TICKER = 0.55*inch
    COL_NAME   = 1.25*inch
    COL_PRICE  = 4.55*inch
    COL_CHANGE = 5.75*inch
    TABLE_W    = W - inch

    def draw_movers_table_full(title, movers, start_y, accent_color):
        cy = start_y
        ROW_H = 0.28*inch

        # Title + underline
        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 11)
        c.drawString(0.5*inch, cy, title)
        cy -= 0.08*inch
        c.setFillColor(rgb(accent_color))
        c.rect(0.5*inch, cy, 1.2*inch, 0.02*inch, fill=1, stroke=0)
        cy -= ROW_H  # header row bottom sits here

        # Header row
        c.setFillColor(rgb(C_LIGHT))
        c.rect(0.5*inch, cy, TABLE_W, ROW_H, fill=1, stroke=0)
        c.setFillColor(rgb(C_MUTED))
        c.setFont('Helvetica-Bold', 8)
        c.drawString(COL_TICKER, cy + 0.09*inch, 'TICKER')
        c.drawString(COL_NAME,   cy + 0.09*inch, 'COMPANY')
        c.drawString(COL_PRICE,  cy + 0.09*inch, 'PRICE')
        c.drawString(COL_CHANGE, cy + 0.09*inch, 'DAY %')
        cy -= ROW_H  # first data row bottom sits here

        for idx, s in enumerate(movers[:5]):
            pct = s.get('pct_change') or 0
            row_bg = (1, 1, 1) if idx % 2 == 0 else C_LIGHT
            c.setFillColor(rgb(row_bg))
            c.rect(0.5*inch, cy, TABLE_W, ROW_H, fill=1, stroke=0)

            c.setFillColor(rgb(accent_color))
            c.setFont('Helvetica-Bold', 9)
            c.drawString(COL_TICKER, cy + 0.09*inch, s.get('ticker', ''))

            c.setFillColor(rgb(C_TEXT))
            c.setFont('Helvetica', 9)
            name = s.get('name', '')
            if len(name) > 42: name = name[:40] + '…'
            c.drawString(COL_NAME,   cy + 0.09*inch, name)
            c.drawString(COL_PRICE,  cy + 0.09*inch, fp(s.get('price')))

            pct_color = C_UP if pct > 0 else C_DOWN if pct < 0 else C_MUTED
            c.setFillColor(rgb(pct_color))
            c.setFont('Helvetica-Bold', 9)
            c.drawString(COL_CHANGE, cy + 0.09*inch, fpct(pct))
            cy -= ROW_H
        return cy

    y = draw_movers_table_full('Top 5 Gainers', top_gainers, y, C_UP)
    y -= 0.35*inch
    y = draw_movers_table_full('Top 5 Losers',  top_losers,  y, C_DOWN)
    y -= 0.3*inch

    # End of page 1 — footer + page break
    advance_page()

    # ── PAGE 2 ────────────────────────────────────────────────────
    y2 = H - 0.8*inch

    # ── Today's Market Analysis callout box ───────────────────────
    if narrative:
        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 13)
        c.drawString(0.5*inch, y2, "Today's Market Analysis")
        y2 -= 0.08*inch
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y2, 1.9*inch, 0.025*inch, fill=1, stroke=0)
        y2 -= 0.25*inch

        # Split narrative into two paragraphs at a sentence boundary near midpoint
        mid = len(narrative) // 2
        split_idx = narrative.find('. ', max(0, mid - 120), mid + 200)
        if split_idx != -1:
            paragraphs = [narrative[:split_idx + 1].strip(),
                          narrative[split_idx + 2:].strip()]
        else:
            paragraphs = [narrative]

        # Pre-wrap all lines so we can size the box accurately
        LINE_H   = 0.175*inch
        PARA_GAP = 0.10*inch
        line_w   = 90
        wrapped  = []   # list of str; '' marks paragraph break
        for pi, para in enumerate(paragraphs):
            words = para.split()
            line  = ''
            for word in words:
                test = (line + ' ' + word).strip()
                if len(test) <= line_w:
                    line = test
                else:
                    wrapped.append(line)
                    line = word
            if line:
                wrapped.append(line)
            if pi < len(paragraphs) - 1:
                wrapped.append('')   # paragraph separator

        box_h = (sum(LINE_H if l else PARA_GAP for l in wrapped)
                 + 0.30*inch)

        # Subtle shadow
        c.setFillColor(Color(0.80, 0.82, 0.86))
        c.roundRect(0.5*inch + 0.035*inch, y2 - box_h - 0.035*inch,
                    W - inch, box_h, 6, fill=1, stroke=0)

        # White background
        c.setFillColor(rgb(C_WHITE))
        c.roundRect(0.5*inch, y2 - box_h, W - inch, box_h, 6, fill=1, stroke=0)

        # Left blue accent border
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y2 - box_h, 0.045*inch, box_h, fill=1, stroke=0)

        # Draw wrapped text
        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica', 9.5)
        ty = y2 - 0.17*inch
        for line_text in wrapped:
            if line_text == '':
                ty -= PARA_GAP
            else:
                c.drawString(0.65*inch, ty, line_text)
                ty -= LINE_H

        y2 = y2 - box_h - 0.3*inch

    # ── Top REIT Headlines ────────────────────────────────────────
    if news:
        if y2 < 2*inch:
            advance_page()
            y2 = H - inch

        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 13)
        c.drawString(0.5*inch, y2, 'Top REIT Headlines')
        y2 -= 0.08*inch
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y2, 1.5*inch, 0.025*inch, fill=1, stroke=0)
        y2 -= 0.28*inch

        for n in news[:8]:
            if y2 < inch:
                advance_page()
                y2 = H - inch
            src   = n.get('source', '')
            title = n.get('title', '')
            if len(title) > 80: title = title[:78] + '…'
            c.setFillColor(rgb(C_ACCENT))
            c.setFont('Helvetica-Bold', 8)
            c.drawString(0.5*inch, y2, f'[{src}]')
            c.setFillColor(rgb(C_TEXT))
            c.setFont('Helvetica', 9)
            c.drawString(0.5*inch + 0.9*inch, y2, title)
            c.setFillColor(rgb(C_BORDER))
            c.rect(0.5*inch, y2 - 0.08*inch, W - inch, 0.01*inch, fill=1, stroke=0)
            y2 -= 0.28*inch

    # Final page footer
    draw_footer(current_page[0])
    c.save()
    buf.seek(0)
    return current_page[0]


def generate_overview_pdf(sdata, market_date):
    # First pass: count total pages (rendering is fast and deterministic)
    dummy = io.BytesIO()
    total_pages = _render_overview_pdf(dummy, sdata, market_date, total_pages=0)
    # Second pass: render with correct 'Page X of Y' in every footer
    buf = io.BytesIO()
    _render_overview_pdf(buf, sdata, market_date, total_pages=total_pages)
    buf.seek(0)
    return buf.read()


def _render_sector_weekly_pdf(buf, sector_key, sdata, week_ending, total_pages):
    """Renders a sector-specific weekly summary PDF. Returns page count."""
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.pdfgen import canvas
    from reportlab.lib.colors import Color

    wr      = sdata.get('weekly_report', {})
    label   = SECTOR_LABELS.get(sector_key, sector_key.title())
    gainers = wr.get('top_gainers', [])
    losers  = wr.get('top_losers', [])
    signals = wr.get('key_signals', [])[:12]
    highlights = wr.get('broad_highlights', [])[:8]
    adv     = wr.get('advancing', 0)
    dec     = wr.get('declining', 0)
    tot     = wr.get('total', 0)

    W, H = letter
    c = canvas.Canvas(buf, pagesize=letter)
    current_page = [1]

    def rgb(t): return Color(t[0], t[1], t[2])

    def draw_footer(pg):
        c.setFillColor(rgb(C_BG))
        c.rect(0, 0, W, 0.5*inch, fill=1, stroke=0)
        c.setFillColor(rgb(C_MUTED))
        c.setFont('Helvetica', 8)
        c.drawString(0.5*inch, 0.18*inch,
                     'Not investment advice  ·  Data via yfinance & public feeds  ·  REIT Dashboard')
        if total_pages > 0:
            c.drawCentredString(W / 2, 0.18*inch, f'Page {pg} of {total_pages}')
        c.drawRightString(W - 0.5*inch, 0.18*inch, week_ending)

    def advance_page():
        draw_footer(current_page[0])
        c.showPage()
        current_page[0] += 1

    # ── PAGE 1 ────────────────────────────────────────────────────
    c.setFillColor(rgb(C_BG))
    c.rect(0, H - 1.4*inch, W, 1.4*inch, fill=1, stroke=0)
    c.setFillColor(rgb(C_ACCENT))
    c.setFont('Helvetica-Bold', 8)
    c.drawString(0.5*inch, H - 0.45*inch, 'REIT DASHBOARD  ·  WEEKLY SECTOR REPORT')
    c.setFillColor(rgb(C_WHITE))
    c.setFont('Helvetica-Bold', 22)
    c.drawString(0.5*inch, H - 0.82*inch, f'{label} REIT Weekly Report')
    c.setFillColor(rgb(C_MUTED))
    c.setFont('Helvetica', 10)
    c.drawString(0.5*inch, H - 1.05*inch, f'Week Ending: {week_ending}  ·  {label} Sector')
    c.setFillColor(rgb(C_ACCENT))
    c.rect(0, H - 1.42*inch, W, 0.04*inch, fill=1, stroke=0)

    y = H - 1.7*inch

    # Breadth strip
    bc = C_UP if adv >= dec else C_DOWN
    c.setFillColor(rgb(C_LIGHT))
    c.roundRect(0.5*inch, y - 0.55*inch, W - inch, 0.65*inch, 6, fill=1, stroke=0)
    c.setFillColor(rgb(bc))
    c.setFont('Helvetica-Bold', 14)
    c.drawString(0.75*inch, y - 0.22*inch, f'{adv} Advancing')
    c.setFillColor(rgb(C_DOWN))
    c.drawString(0.75*inch + 1.6*inch, y - 0.22*inch, f'{dec} Declining')
    c.setFillColor(rgb(C_MUTED))
    c.setFont('Helvetica', 10)
    c.drawString(0.75*inch + 3.2*inch, y - 0.22*inch, f'of {tot} {label} REITs')
    y -= 0.9*inch

    # Top Gainers / Losers (two columns)
    def draw_half_table(title, movers, x_off, col_w, color):
        cy = y
        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 11)
        c.drawString(x_off, cy, title)
        cy -= 0.08*inch
        c.setFillColor(rgb(color))
        c.rect(x_off, cy, 1.1*inch, 0.02*inch, fill=1, stroke=0)
        cy -= 0.22*inch
        c.setFillColor(rgb(C_LIGHT))
        c.rect(x_off, cy - 0.04*inch, col_w, 0.22*inch, fill=1, stroke=0)
        c.setFillColor(rgb(C_MUTED))
        c.setFont('Helvetica-Bold', 7)
        c.drawString(x_off + 0.05*inch, cy + 0.07*inch, 'TICKER')
        c.drawString(x_off + 0.55*inch, cy + 0.07*inch, 'NAME')
        c.drawString(x_off + col_w - 0.55*inch, cy + 0.07*inch, 'WK %')
        cy -= 0.04*inch
        for idx, s in enumerate(movers):
            row_bg = (1, 1, 1) if idx % 2 == 0 else C_LIGHT
            c.setFillColor(rgb(row_bg))
            c.rect(x_off, cy - 0.08*inch, col_w, 0.26*inch, fill=1, stroke=0)
            c.setFillColor(rgb(color))
            c.setFont('Helvetica-Bold', 8)
            c.drawString(x_off + 0.05*inch, cy + 0.05*inch, s.get('ticker', ''))
            c.setFillColor(rgb(C_TEXT))
            c.setFont('Helvetica', 8)
            name = s.get('name', '')
            if len(name) > 18: name = name[:16] + '…'
            c.drawString(x_off + 0.55*inch, cy + 0.05*inch, name)
            wpct = s.get('weekly_pct', 0)
            sign = '+' if wpct > 0 else ''
            c.setFillColor(rgb(C_UP if wpct > 0 else C_DOWN))
            c.setFont('Helvetica-Bold', 8)
            c.drawRightString(x_off + col_w - 0.05*inch, cy + 0.05*inch, f'{sign}{wpct:.2f}%')
            cy -= 0.25*inch

    col_w = (W - inch) / 2 - 0.1*inch
    draw_half_table('Top Gainers — Week', gainers, 0.5*inch, col_w, C_UP)
    draw_half_table('Top Losers — Week',  losers,  0.5*inch + col_w + 0.2*inch, col_w, C_DOWN)

    advance_page()

    # ── PAGE 2 ────────────────────────────────────────────────────
    y2 = H - 0.8*inch

    if signals:
        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 13)
        c.drawString(0.5*inch, y2, 'Key Signals This Week')
        y2 -= 0.08*inch
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y2, 1.7*inch, 0.025*inch, fill=1, stroke=0)
        y2 -= 0.28*inch
        for sig in signals:
            if y2 < inch:
                advance_page()
                y2 = H - inch
            txt = sig if len(sig) <= 85 else sig[:83] + '…'
            c.setFillColor(rgb(C_ACCENT))
            c.rect(0.5*inch, y2 + 0.01*inch, 0.03*inch, 0.1*inch, fill=1, stroke=0)
            c.setFillColor(rgb(C_TEXT))
            c.setFont('Helvetica', 9)
            c.drawString(0.62*inch, y2 + 0.04*inch, txt)
            c.setFillColor(rgb(C_BORDER))
            c.rect(0.5*inch, y2 - 0.07*inch, W - inch, 0.01*inch, fill=1, stroke=0)
            y2 -= 0.26*inch
        y2 -= 0.15*inch

    if highlights:
        if y2 < 2*inch:
            advance_page()
            y2 = H - inch
        c.setFillColor(rgb(C_TEXT))
        c.setFont('Helvetica-Bold', 13)
        c.drawString(0.5*inch, y2, 'Macro & Sector Highlights')
        y2 -= 0.08*inch
        c.setFillColor(rgb(C_ACCENT))
        c.rect(0.5*inch, y2, 2.1*inch, 0.025*inch, fill=1, stroke=0)
        y2 -= 0.28*inch
        for hl in highlights:
            if y2 < inch:
                advance_page()
                y2 = H - inch
            txt = hl if len(hl) <= 85 else hl[:83] + '…'
            c.setFillColor(rgb(C_MUTED))
            c.setFont('Helvetica', 8)
            c.drawString(0.5*inch, y2 + 0.04*inch, '·')
            c.setFillColor(rgb(C_TEXT))
            c.setFont('Helvetica', 9)
            c.drawString(0.65*inch, y2 + 0.04*inch, txt)
            c.setFillColor(rgb(C_BORDER))
            c.rect(0.5*inch, y2 - 0.07*inch, W - inch, 0.01*inch, fill=1, stroke=0)
            y2 -= 0.26*inch

    draw_footer(current_page[0])
    c.save()
    buf.seek(0)
    return current_page[0]


def generate_sector_weekly_pdf(sector_key, sdata, week_ending):
    dummy = io.BytesIO()
    total = _render_sector_weekly_pdf(dummy, sector_key, sdata, week_ending, total_pages=0)
    buf   = io.BytesIO()
    _render_sector_weekly_pdf(buf, sector_key, sdata, week_ending, total_pages=total)
    buf.seek(0)
    return buf.read()


def upload_pdf(sector_key, pdf_bytes, date_str):
    path = f'{sector_key}/{date_str}.pdf'
    url  = f'{SUPABASE_URL}/storage/v1/object/{BUCKET}/{path}'

    # Upsert (delete then re-upload so today's always fresh)
    requests.delete(url, headers={
        'apikey': SUPABASE_SERVICE,
        'Authorization': f'Bearer {SUPABASE_SERVICE}',
    })
    r = requests.post(url, data=pdf_bytes, headers={
        'apikey':         SUPABASE_SERVICE,
        'Authorization':  f'Bearer {SUPABASE_SERVICE}',
        'Content-Type':   'application/pdf',
        'Cache-Control':  'max-age=3600',
    }, timeout=30)
    r.raise_for_status()
    public_url = f'{SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}'
    return public_url


def main():
    print('\n=== REIT Sector PDF Generator ===')

    if not all([SUPABASE_URL, SUPABASE_SERVICE]):
        print('Missing SUPABASE env vars — skipping.')
        return

    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'market_data.json')
    with open(data_path) as f:
        market_data = json.load(f)

    sectors     = market_data.get('sectors', {})
    market_date = market_data.get('market_date', datetime.now().strftime('%Y-%m-%d'))
    # market_date may be "April 10, 2026" — normalise to YYYY-MM-DD for file paths
    try:
        date_str = datetime.strptime(market_date, '%B %d, %Y').strftime('%Y-%m-%d')
    except ValueError:
        date_str = market_date

    try:
        import reportlab
    except ImportError:
        print('reportlab not installed — skipping PDF generation.')
        return

    generated = 0
    for sector_key, sdata in sectors.items():
        if not sdata.get('stocks'):
            continue
        try:
            print(f'  Generating {sector_key}…', end=' ')
            if sector_key == 'overview':
                pdf_bytes = generate_overview_pdf(sdata, market_date)
            else:
                pdf_bytes  = generate_pdf(sector_key, sdata, market_date)
            public_url = upload_pdf(sector_key, pdf_bytes, date_str)
            print(f'✓  {public_url}')
            generated += 1
        except Exception as e:
            print(f'✗  {e}', file=sys.stderr)

    # ── Per-sector weekly PDFs (generated when weekly_report data exists) ──
    for sector_key, sdata in sectors.items():
        if sector_key == 'overview' or not sdata.get('weekly_report'):
            continue
        wr = sdata['weekly_report']
        week_ending_str = wr.get('week_ending', market_date)
        try:
            week_date_str = datetime.strptime(week_ending_str, '%B %d, %Y').strftime('%Y-%m-%d')
        except ValueError:
            week_date_str = date_str
        try:
            print(f'  Generating {sector_key} weekly…', end=' ')
            weekly_bytes = generate_sector_weekly_pdf(sector_key, sdata, week_ending_str)
            public_url   = upload_pdf(f'{sector_key}/weekly', weekly_bytes, week_date_str)
            print(f'✓  {public_url}')
            generated += 1
        except Exception as e:
            print(f'✗  {e}', file=sys.stderr)

    print(f'\nDone. {generated} PDFs uploaded.')


if __name__ == '__main__':
    main()

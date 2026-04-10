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
    date_str    = market_date  # YYYY-MM-DD

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
            pdf_bytes  = generate_pdf(sector_key, sdata, market_date)
            public_url = upload_pdf(sector_key, pdf_bytes, date_str)
            print(f'✓  {public_url}')
            generated += 1
        except Exception as e:
            print(f'✗  {e}', file=sys.stderr)

    print(f'\nDone. {generated} PDFs uploaded.')


if __name__ == '__main__':
    main()

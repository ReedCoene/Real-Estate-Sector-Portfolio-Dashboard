"""
REIT Daily Email Brief — sends personalized sector digests to subscribers.
Runs after fetch_data.py in GitHub Actions.
"""
import json, os, sys, requests, smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

SUPABASE_URL     = os.environ.get('SUPABASE_URL', '')
SUPABASE_SERVICE = os.environ.get('SUPABASE_SERVICE_KEY', '')
GMAIL_USER       = os.environ.get('GMAIL_USER', '')
GMAIL_APP_PASS   = os.environ.get('GMAIL_APP_PASS', '')

_repo = os.environ.get('GITHUB_REPOSITORY', 'ReedCoene/Real-Estate-Sector-Portfolio-Dashboard')
_owner, _name = (_repo.split('/', 1) + [''])[:2]
SITE_URL = f"https://{_owner}.github.io/{_name}"

SECTOR_LABELS = {
    'healthcare': 'Healthcare', 'housing': 'Housing', 'industrial': 'Industrial',
    'retail': 'Retail / Mall', 'hospitality': 'Hospitality',
    'netlease': 'Net Lease', 'tower': 'Tower',
}

def get_subscribers():
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/subscribers?select=email,sector,unsubscribe_token",
        headers={'apikey': SUPABASE_SERVICE, 'Authorization': f'Bearer {SUPABASE_SERVICE}'},
        timeout=10,
    )
    r.raise_for_status()
    return r.json()

def fp(v):
    return f'${float(v):.2f}' if v else '—'

def fpct(v):
    if v is None: return '—'
    return f'{"+" if v > 0 else ""}{float(v):.2f}%'

def fcap(v):
    if not v: return '—'
    return f'${v/1e9:.1f}B' if v >= 1e9 else f'${v/1e6:.0f}M'

def pcol(v):
    if not v: return '#6b7280'
    return '#00c087' if v > 0 else '#f6465d'

def build_html(sector_key, sdata, unsub_url):
    label   = SECTOR_LABELS.get(sector_key, sector_key.title())
    focus   = sdata.get('focus_ticker', '')
    stocks  = sdata.get('stocks', {})
    news    = sdata.get('news', [])
    fd      = sdata.get('focus_details', {})
    date_str = datetime.now().strftime('%B %d, %Y')

    vals      = list(stocks.values())
    advancing = sum(1 for s in vals if s.get('pct_change', 0) > 0)
    declining = sum(1 for s in vals if s.get('pct_change', 0) < 0)

    sorted_s = sorted(vals, key=lambda s: s.get('pct_change', 0), reverse=True)
    movers   = [s for s in sorted_s if s.get('pct_change', 0) > 0][:3] + \
               [s for s in reversed(sorted_s) if s.get('pct_change', 0) < 0][:3]

    focus_stock = stocks.get(focus, {})
    signals     = [n for n in news if n.get('is_signal')][:6]

    # Movers rows
    mover_rows = ''
    for s in movers:
        pct = s.get('pct_change', 0)
        mover_rows += f'''<tr>
          <td style="padding:10px 0;border-bottom:1px solid #eaecf2;font-family:monospace;font-size:13px;font-weight:700;color:#0a0b0d">{s["ticker"]}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eaecf2;font-size:12px;color:#6b7280">{s.get("name","")}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eaecf2;text-align:right;font-size:13px;font-weight:600;color:#0a0b0d;font-variant-numeric:tabular-nums">{fp(s.get("price"))}</td>
          <td style="padding:10px 0;border-bottom:1px solid #eaecf2;text-align:right;font-size:13px;font-weight:700;color:{pcol(pct)};font-variant-numeric:tabular-nums">{fpct(pct)}</td>
        </tr>'''

    # Signal rows
    sig_rows = ''
    for n in signals:
        src   = n.get('ticker') or n.get('source', '')
        title = n.get('title', '')
        link  = n.get('link', '')
        title_html = f'<a href="{link}" style="color:#0052ff;text-decoration:none">{title}</a>' if link else title
        sig_rows += f'<div style="padding:9px 0;border-bottom:1px solid #eaecf2;font-size:13px;color:#2e3340;line-height:1.5"><span style="font-family:monospace;font-size:10px;font-weight:700;background:#f4f6fa;border-radius:4px;padding:1px 6px;margin-right:8px;color:#0052ff">{src}</span>{title_html}</div>'

    # Focus section
    thesis_html = ''.join(
        f'<div style="font-size:12px;color:#4a5060;padding:5px 0 5px 12px;border-left:2px solid #0052ff;margin-bottom:5px;line-height:1.5">{p}</div>'
        for p in fd.get('thesis_points', [])[:2]
    )
    next_date_html = ''
    if fd.get('key_dates'):
        d = fd['key_dates'][0]
        next_date_html = f'<div style="font-size:12px;color:#6b7280;margin-top:10px">Next: <strong style="color:#0a0b0d">{d["event"]}</strong> — {d["date"]}</div>'

    fp_pct = focus_stock.get('pct_change', 0)
    focus_section = f'''
    <div style="background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:12px;border:1px solid #eaecf2">
      <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;margin-bottom:14px">Focus · {focus}</div>
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:12px;margin-bottom:14px">
        <div>
          <div style="font-size:15px;font-weight:700;color:#0a0b0d">{fd.get("name", focus)}</div>
          <div style="font-size:11px;color:#6b7280;margin-top:2px">{fd.get("sector","")}</div>
        </div>
        <div style="text-align:right">
          <div style="font-size:22px;font-weight:700;color:#0a0b0d;font-variant-numeric:tabular-nums">{fp(focus_stock.get("price"))}</div>
          <div style="font-size:13px;font-weight:700;color:{pcol(fp_pct)}">{fpct(fp_pct)} today</div>
        </div>
      </div>
      <div style="display:flex;gap:24px;margin-bottom:14px;flex-wrap:wrap">
        <div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px">Mkt Cap</div><div style="font-size:13px;font-weight:600;color:#0a0b0d">{fcap(focus_stock.get("market_cap"))}</div></div>
        <div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px">Yield</div><div style="font-size:13px;font-weight:600;color:#0a0b0d">{focus_stock.get("dividend_yield") or "—"}%</div></div>
        <div><div style="font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:.5px">52W Range</div><div style="font-size:13px;font-weight:600;color:#0a0b0d">{fp(focus_stock.get("fifty_two_week_low"))} – {fp(focus_stock.get("fifty_two_week_high"))}</div></div>
      </div>
      {thesis_html}
      {next_date_html}
    </div>''' if focus_stock else ''

    bc = '#00c087' if advancing >= declining else '#f6465d'

    return f'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{label} REIT Brief — {date_str}</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px 40px">

  <div style="background:#0a0b0d;border-radius:16px 16px 0 0;padding:28px 32px 20px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#578bfa;margin-bottom:6px">Daily Brief</div>
    <div style="font-size:24px;font-weight:600;color:#fff;letter-spacing:-.4px">{label} REIT Brief</div>
    <div style="font-size:13px;color:#4a5060;margin-top:6px">{date_str}</div>
  </div>

  <div style="background:#111316;border-radius:0 0 16px 16px;padding:14px 32px;margin-bottom:16px">
    <span style="font-size:16px;font-weight:700;color:{bc}">{advancing} up</span>
    <span style="color:#4a5060;margin:0 8px">·</span>
    <span style="font-size:16px;font-weight:700;color:#f6465d">{declining} down</span>
    <span style="font-size:12px;color:#4a5060;margin-left:6px">of {len(vals)} {label.lower()} REITs today</span>
  </div>

  {focus_section}

  <div style="background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:12px;border:1px solid #eaecf2">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;margin-bottom:14px">Today's Movers</div>
    <table style="width:100%;border-collapse:collapse"><tbody>{mover_rows}</tbody></table>
  </div>

  {'<div style="background:#fff;border-radius:12px;padding:20px 24px;margin-bottom:12px;border:1px solid #eaecf2"><div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#6b7280;margin-bottom:14px">Key Signals</div>' + sig_rows + '</div>' if sig_rows else ''}

  <div style="text-align:center;padding:20px 0 4px">
    <a href="{SITE_URL}" style="color:#0052ff;text-decoration:none;font-size:13px;font-weight:600">View Full Dashboard</a>
    <span style="color:#d1d5db;margin:0 10px">·</span>
    <a href="{unsub_url}" style="color:#9ca3af;text-decoration:none;font-size:12px">Unsubscribe</a>
    <div style="font-size:11px;color:#9ca3af;margin-top:10px">Not investment advice · Data via yfinance &amp; public feeds</div>
  </div>

</div>
</body>
</html>'''


def send_via_gmail(to, subject, html):
    msg = MIMEMultipart('alternative')
    msg['Subject'] = subject
    msg['From']    = f'REIT Dashboard <{GMAIL_USER}>'
    msg['To']      = to
    msg.attach(MIMEText(html, 'html'))
    with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASS)
        server.sendmail(GMAIL_USER, to, msg.as_string())


def main():
    print("=== REIT Daily Email Brief ===")
    if not all([SUPABASE_URL, SUPABASE_SERVICE, GMAIL_USER, GMAIL_APP_PASS]):
        print("Missing env vars — skipping.")
        return

    data_path = os.path.join(os.path.dirname(__file__), '..', 'data', 'market_data.json')
    with open(data_path) as f:
        market_data = json.load(f)

    sectors = market_data.get('sectors', {})
    if not sectors:
        print("No sector data — skipping.")
        return

    print("Fetching subscribers...")
    subs = get_subscribers()
    if not subs:
        print("No subscribers yet.")
        return
    print(f"  {len(subs)} subscriber(s)")

    date_str = datetime.now().strftime('%B %d, %Y')
    sent = failed = 0

    for sub in subs:
        email  = sub.get('email', '')
        sector = sub.get('sector', 'healthcare')
        token  = sub.get('unsubscribe_token', '')
        sdata  = sectors.get(sector, {})

        if not email or not sdata.get('stocks'):
            continue

        label     = SECTOR_LABELS.get(sector, sector.title())
        subject   = f"📊 {label} REIT Brief — {date_str}"
        unsub_url = f"{SITE_URL}/?unsub={token}"
        html      = build_html(sector, sdata, unsub_url)

        try:
            send_via_gmail(email, subject, html)
            print(f"  ✓ {email} ({label})")
            sent += 1
        except Exception as e:
            print(f"  ✗ {email}: {e}", file=sys.stderr)
            failed += 1

    print(f"\nDone. {sent} sent, {failed} failed.")


if __name__ == '__main__':
    main()

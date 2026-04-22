"""
Morning Finance Brief — daily email to reedcoene@gmail.com
Runs at 8 AM ET via GitHub Actions. Uses yfinance for live market data,
RSS feeds for REIT/real estate news, and Claude to write the brief.
"""
import os, smtplib, sys
from datetime import datetime, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

import anthropic
import feedparser
import yfinance as yf

GMAIL_USER        = os.environ["GMAIL_USER"]
GMAIL_APP_PASS    = os.environ["GMAIL_APP_PASS"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
TO_EMAIL          = "reedcoene@gmail.com"

REIT_NEWS_FEEDS = [
    "https://www.reit.com/rss.xml",
    "https://feeds.content.dowjones.io/public/rss/mw_realestate",
    "https://skillednursingnews.com/feed/",
]

CONCEPTS = [
    "DCF (Discounted Cash Flow) mechanics",
    "cap rates and how they relate to property valuation",
    "EBITDA multiples and enterprise value",
    "duration risk in fixed income",
    "yield curve shapes and what they signal",
    "carried interest in private equity",
    "LTV (Loan-to-Value) ratios in real estate lending",
    "FFO (Funds From Operations) for REITs",
    "Net Operating Income (NOI)",
    "Weighted Average Cost of Capital (WACC)",
    "beta and systematic risk",
    "price-to-book ratio",
    "dividend yield vs. total return",
    "interest coverage ratio",
    "debt-to-EBITDA leverage",
    "IRR vs. equity multiple in real estate",
    "preferred equity vs. common equity",
    "DSCR (Debt Service Coverage Ratio)",
    "going-in cap rate vs. exit cap rate",
    "accretion and dilution analysis in M&A",
    "NAV (Net Asset Value) for REITs",
    "convertible notes and dilution",
    "terminal value in a DCF",
    "operating leverage vs. financial leverage",
]


def fetch_market_data() -> dict:
    spx  = yf.Ticker("^GSPC")
    tny  = yf.Ticker("^TNX")

    spx_hist = spx.history(period="2d").dropna(subset=["Close"])
    tny_hist = tny.history(period="2d").dropna(subset=["Close"])

    result = {}

    if len(spx_hist) >= 2:
        prev, curr = float(spx_hist["Close"].iloc[-2]), float(spx_hist["Close"].iloc[-1])
        result["spx_level"]  = round(curr, 2)
        result["spx_change"] = round(curr - prev, 2)
        result["spx_pct"]    = round((curr - prev) / prev * 100, 2)
    elif len(spx_hist) == 1:
        result["spx_level"]  = round(float(spx_hist["Close"].iloc[-1]), 2)
        result["spx_change"] = 0
        result["spx_pct"]    = 0

    if len(tny_hist) >= 2:
        prev, curr = float(tny_hist["Close"].iloc[-2]), float(tny_hist["Close"].iloc[-1])
        result["tny_yield"]  = round(curr, 3)
        result["tny_change"] = round(curr - prev, 3)
    elif len(tny_hist) == 1:
        result["tny_yield"]  = round(float(tny_hist["Close"].iloc[-1]), 3)
        result["tny_change"] = 0

    return result


def fetch_reit_news() -> list[str]:
    headlines = []
    for url in REIT_NEWS_FEEDS:
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:3]:
                title = entry.get("title", "").strip()
                if title:
                    headlines.append(title)
        except Exception as e:
            print(f"  Feed error {url}: {e}", file=sys.stderr)
    return headlines[:8]


def generate_brief(market: dict, headlines: list[str], concept_topic: str) -> str:
    spx_dir   = "up" if market.get("spx_pct", 0) >= 0 else "down"
    tny_dir   = "up" if market.get("tny_change", 0) >= 0 else "down"
    news_text = "\n".join(f"- {h}" for h in headlines) if headlines else "No headlines available."

    prompt = f"""You are writing a daily morning finance brief. Today is {datetime.now().strftime('%B %d, %Y')}.

Here is today's live market data:
- S&P 500: {market.get('spx_level', 'N/A')} ({market.get('spx_pct', 0):+.2f}% / {spx_dir} {abs(market.get('spx_change', 0)):.2f} pts)
- 10-year Treasury yield: {market.get('tny_yield', 'N/A')}% ({tny_dir} {abs(market.get('tny_change', 0)):.3f}%)

Today's REIT and real estate headlines:
{news_text}

Write the brief below. Use exactly these three sections with these bold headers. Keep it under 300 words total.

**📈 MARKET SNAPSHOT**
- S&P 500: state the level, direction, and ONE clear reason why (use the data above; infer the reason from current macro context)
- 10-year Treasury yield: state the level and direction
- One sentence on overall market sentiment today

**🏠 REAL ESTATE & RATES**
Pick the most interesting headline from the list above and write 2-3 sentences on what it means for REITs or real estate investors. If none are relevant, use your knowledge of today's macro environment.

**🧠 CONCEPT OF THE DAY**
Topic: {concept_topic}
Explain this concept in 4-5 sentences like a sharp analyst talking to a motivated intern. Give one concrete real-world example. Do not use the phrase "imagine you are" — just explain it directly.

Write like a senior analyst briefing a junior colleague. Direct, no fluff, polished enough to screenshot."""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    msg = client.messages.create(
        model="claude-sonnet-4-6",
        max_tokens=600,
        messages=[{"role": "user", "content": prompt}],
    )
    return msg.content[0].text.strip()


def brief_to_html(brief_text: str, date_str: str) -> str:
    # Convert markdown bold to <strong> and newlines to <br>
    lines = brief_text.split("\n")
    body_html = ""
    for line in lines:
        line = line.strip()
        if not line:
            body_html += '<div style="height:14px"></div>'
            continue
        # Section headers
        if line.startswith("**") and line.endswith("**"):
            inner = line[2:-2]
            body_html += f'<div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#578bfa;margin:18px 0 8px">{inner}</div>'
        elif line.startswith("- "):
            body_html += f'<div style="font-size:13px;color:#c8cdd8;line-height:1.6;padding:3px 0 3px 12px;border-left:2px solid #1e2229">{line[2:]}</div>'
        else:
            body_html += f'<div style="font-size:13px;color:#c8cdd8;line-height:1.7;padding:2px 0">{line}</div>'

    return f'''<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Daily Finance Brief — {date_str}</title></head>
<body style="margin:0;padding:0;background:#0a0b0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">
<div style="max-width:600px;margin:0 auto;padding:24px 16px 40px">

  <div style="background:#0a0b0d;border-radius:16px 16px 0 0;padding:28px 32px 20px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#578bfa;margin-bottom:6px">Morning Brief</div>
    <div style="font-size:24px;font-weight:600;color:#fff;letter-spacing:-.4px">Daily Finance Brief</div>
    <div style="font-size:13px;color:#4a5060;margin-top:6px">{date_str}</div>
  </div>

  <div style="background:#111316;border-radius:0 0 16px 16px;padding:20px 32px 24px;margin-bottom:16px;border:1px solid #1e2229">
    {body_html}
  </div>

  <div style="text-align:center;padding:12px 0 4px">
    <div style="font-size:11px;color:#6b7280">Not investment advice · Data via yfinance &amp; public feeds</div>
  </div>

</div>
</body>
</html>'''


def send_email(subject: str, html: str) -> None:
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"Finance Brief <{GMAIL_USER}>"
    msg["To"]      = TO_EMAIL
    msg.attach(MIMEText(html, "html"))
    with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
        server.login(GMAIL_USER, GMAIL_APP_PASS)
        server.sendmail(GMAIL_USER, TO_EMAIL, msg.as_string())


def main():
    print("=== Morning Finance Brief ===")
    date_str = datetime.now().strftime("%B %d, %Y")

    print("Fetching market data...")
    market = fetch_market_data()
    print(f"  SPX: {market.get('spx_level')} ({market.get('spx_pct', 0):+.2f}%)")
    print(f"  TNX: {market.get('tny_yield')}%")

    print("Fetching REIT/real estate news...")
    headlines = fetch_reit_news()
    print(f"  {len(headlines)} headlines")

    day_of_year   = datetime.now().timetuple().tm_yday
    concept_topic = CONCEPTS[day_of_year % len(CONCEPTS)]
    print(f"Concept of the day: {concept_topic}")

    print("Generating brief via Claude...")
    brief_text = generate_brief(market, headlines, concept_topic)

    html    = brief_to_html(brief_text, date_str)
    subject = f"📊 Daily Finance Brief — {date_str}"

    print(f"Sending to {TO_EMAIL}...")
    send_email(subject, html)
    print("Done.")


if __name__ == "__main__":
    main()

"""
GSIF REIT Portfolio Dashboard — Daily Data Fetcher
Holdings: CTRE, MAC, XHR, EPRT, MRP, TRNO, SBAC
Runs via GitHub Actions after market close Mon–Fri.
"""

import json, os, sys
from datetime import datetime, timezone
import feedparser, requests, yfinance as yf

NEWS_API_KEY = os.environ.get("NEWS_API_KEY")

# ── Portfolio holdings ────────────────────────────────────────
PORTFOLIO = {
    "CTRE": "CareTrust REIT",
    "MAC":  "Macerich",
    "XHR":  "Xenia Hotels & Resorts",
    "EPRT": "Essential Properties Realty Trust",
    "MRP":  "Millrose Properties",
    "TRNO": "Terreno Realty",
    "SBAC": "SBA Communications",
}

# ── Sector peer universe ──────────────────────────────────────
PEERS = {
    # Healthcare
    "WELL": "Welltower",
    "VTR":  "Ventas",
    "OHI":  "Omega Healthcare",
    # Mall / Retail
    "SPG":  "Simon Property Group",
    "SKT":  "Tanger Outlets",
    # Hospitality
    "PK":   "Park Hotels & Resorts",
    "HST":  "Host Hotels & Resorts",
    # Net Lease
    "O":    "Realty Income",
    "NNN":  "NNN REIT",
    "ADC":  "Agree Realty",
    # Homebuilder / Land
    "LEN":  "Lennar",
    # Industrial
    "PLD":  "Prologis",
    "EGP":  "EastGroup Properties",
    "REXR": "Rexford Industrial",
    "STAG": "STAG Industrial",
    # Towers
    "AMT":  "American Tower",
    "CCI":  "Crown Castle",
}

ALL_TICKERS = {**PORTFOLIO, **PEERS}

# ── News feeds — multi-sector ─────────────────────────────────
BROAD_FEEDS = [
    {"source": "Nareit",              "url": "https://www.reit.com/rss.xml",                              "category": "broad"},
    {"source": "MarketWatch RE",      "url": "https://feeds.content.dowjones.io/public/rss/mw_realestate","category": "broad"},
    {"source": "The Real Deal",       "url": "https://therealdeal.com/feed/",                             "category": "broad"},
    {"source": "GlobeSt",             "url": "https://www.globest.com/feed/",                             "category": "broad"},
    # Healthcare
    {"source": "Becker's Hospital",   "url": "https://www.beckershospitalreview.com/rss/news.xml",        "category": "healthcare"},
    {"source": "McKnight's LTC",      "url": "https://www.mcknights.com/news/feed/",                      "category": "healthcare"},
    # Industrial / Logistics
    {"source": "Supply Chain Dive",   "url": "https://www.supplychaindive.com/feeds/news/",               "category": "industrial"},
    {"source": "DC Velocity",         "url": "https://www.dcvelocity.com/rss/",                           "category": "industrial"},
    {"source": "FreightWaves",        "url": "https://www.freightwaves.com/news/feed",                    "category": "industrial"},
    # Housing / Land
    {"source": "HousingWire",         "url": "https://www.housingwire.com/feed/",                         "category": "housing"},
    # Hospitality
    {"source": "Hotel News Now",      "url": "https://www.hotelnewsnow.com/rss",                          "category": "hospitality"},
    # Telecom / Towers
    {"source": "Fierce Wireless",     "url": "https://www.fiercewireless.com/rss/xml",                    "category": "towers"},
    {"source": "RCR Wireless",        "url": "https://www.rcrwireless.com/feed",                          "category": "towers"},
    # Retail
    {"source": "ICSC",                "url": "https://www.icsc.com/news-and-views/rss",                   "category": "retail"},
]

SIGNAL_KEYWORDS = [
    "earnings", "ffo", "affo", "dividend", "acquisition", "merger", "guidance",
    "upgrade", "downgrade", "price target", "initiates", "raises", "cuts",
    "occupancy", "beat", "miss", "offering", "investment", "tenant",
    "rating", "coverage", "quarter", "annual", "outlook", "forecast",
    "leasing", "vacancy", "cap rate", "noi", "same-store", "revpar",
    "supply chain", "e-commerce", "logistics", "warehouse", "tariff",
    "tower", "5g", "carrier", "churn", "lease", "rent growth",
    "homebuilder", "land banking", "walkaway", "option fee",
    "mall", "retail", "hotel", "resort", "net lease",
]


def fetch_prices(tickers_dict: dict) -> dict:
    results = {}
    try:
        batch = yf.Tickers(" ".join(tickers_dict.keys()))
    except Exception as e:
        print(f"Batch init failed: {e}", file=sys.stderr)
        batch = None

    for ticker, name in tickers_dict.items():
        try:
            stock = batch.tickers[ticker] if batch else yf.Ticker(ticker)
            info  = stock.info or {}
            hist  = stock.history(period="5d").dropna(subset=["Close"])

            if len(hist) >= 2:
                prev = float(hist["Close"].iloc[-2])
                curr = float(hist["Close"].iloc[-1])
            elif len(hist) == 1:
                curr = float(hist["Close"].iloc[-1])
                prev = curr
            else:
                print(f"  No history: {ticker}", file=sys.stderr)
                continue

            pct = ((curr - prev) / prev * 100) if prev else 0
            raw_yield = info.get("dividendYield") or 0
            div_yield = round(min(raw_yield if raw_yield > 1 else raw_yield * 100, 30), 2)

            next_earnings = None
            try:
                cal = stock.calendar
                if isinstance(cal, dict):
                    ed = cal.get('Earnings Date')
                    if ed:
                        next_earnings = str(ed[0] if hasattr(ed, '__len__') else ed)[:10]
                elif cal is not None and hasattr(cal, 'columns'):
                    col = cal.get('Earnings Date')
                    if col is not None:
                        next_earnings = str(list(col.values())[0])[:10]
            except Exception:
                pass
            if not next_earnings:
                try:
                    ts = info.get('earningsTimestamp') or info.get('earningsDate')
                    if ts and isinstance(ts, (int, float)):
                        next_earnings = datetime.fromtimestamp(ts, tz=timezone.utc).strftime('%Y-%m-%d')
                except Exception:
                    pass

            results[ticker] = {
                "name":                name,
                "ticker":              ticker,
                "price":               round(curr, 2),
                "prev_close":          round(prev, 2),
                "pct_change":          round(pct, 2),
                "market_cap":          info.get("marketCap") or 0,
                "dividend_yield":      div_yield,
                "fifty_two_week_high": info.get("fiftyTwoWeekHigh") or 0,
                "fifty_two_week_low":  info.get("fiftyTwoWeekLow") or 0,
                "next_earnings":       next_earnings,
                "is_portfolio":        ticker in PORTFOLIO,
                "sector":              PORTFOLIO_SECTORS.get(ticker, ""),
            }
            print(f"  {ticker}: ${curr:.2f} ({pct:+.2f}%)")
        except Exception as e:
            print(f"  ERROR {ticker}: {e}", file=sys.stderr)

    return results


def fetch_reit_news() -> list:
    items = []
    for ticker, name in ALL_TICKERS.items():
        url = f"https://feeds.finance.yahoo.com/rss/2.0/headline?s={ticker}&region=US&lang=en-US"
        try:
            feed = feedparser.parse(url)
            for entry in feed.entries[:4]:
                summary = entry.get("summary", "") or ""
                items.append({
                    "ticker":    ticker,
                    "company":   name,
                    "source":    ticker,
                    "category":  "reit",
                    "title":     entry.get("title", "").strip(),
                    "link":      entry.get("link", ""),
                    "published": entry.get("published", entry.get("updated", "")),
                    "summary":   summary[:300] + ("…" if len(summary) > 300 else ""),
                    "is_signal": False,
                    "is_portfolio": ticker in PORTFOLIO,
                })
        except Exception as e:
            print(f"  News ERROR {ticker}: {e}", file=sys.stderr)
    return items


def fetch_broad_news() -> list:
    items = []
    for feed_cfg in BROAD_FEEDS:
        try:
            feed = feedparser.parse(feed_cfg["url"])
            for entry in feed.entries[:5]:
                summary = entry.get("summary", "") or ""
                items.append({
                    "ticker":       None,
                    "company":      None,
                    "source":       feed_cfg["source"],
                    "category":     feed_cfg["category"],
                    "title":        entry.get("title", "").strip(),
                    "link":         entry.get("link", ""),
                    "published":    entry.get("published", entry.get("updated", "")),
                    "summary":      summary[:300] + ("…" if len(summary) > 300 else ""),
                    "is_signal":    False,
                    "is_portfolio": False,
                })
            print(f"  {feed_cfg['source']}: {min(5, len(feed.entries))} items")
        except Exception as e:
            print(f"  Feed ERROR {feed_cfg['source']}: {e}", file=sys.stderr)
    return items


def tag_signals(items: list) -> list:
    for item in items:
        text = (item["title"] + " " + item.get("summary", "")).lower()
        item["is_signal"] = any(kw in text for kw in SIGNAL_KEYWORDS)
    return items


def fetch_newsapi() -> list:
    if not NEWS_API_KEY:
        print("  NEWS_API_KEY not set — skipping NewsAPI")
        return []

    queries = [
        "REIT earnings FFO dividend real estate investment trust",
        "Macerich OR CareTrust OR Terreno OR \"Essential Properties\" OR \"Millrose Properties\"",
        "\"SBA Communications\" OR \"Xenia Hotels\" OR tower REIT 5G",
        "net lease REIT mall hotel industrial land banking",
    ]

    items, seen = [], set()
    for q in queries:
        try:
            resp = requests.get(
                "https://newsapi.org/v2/everything",
                params={"q": q, "language": "en", "sortBy": "publishedAt", "pageSize": 10, "apiKey": NEWS_API_KEY},
                timeout=10,
            )
            resp.raise_for_status()
            for art in resp.json().get("articles", []):
                url = art.get("url", "")
                if url in seen:
                    continue
                seen.add(url)
                items.append({
                    "ticker": None, "company": None,
                    "source": art.get("source", {}).get("name", "News"),
                    "category": "broad",
                    "title": (art.get("title") or "").strip(),
                    "link": url,
                    "published": art.get("publishedAt", ""),
                    "summary": (art.get("description") or "")[:300],
                    "is_signal": False,
                    "is_portfolio": False,
                })
        except Exception as e:
            print(f"  NewsAPI ERROR: {e}", file=sys.stderr)

    print(f"  NewsAPI: {len(items)} articles")
    return items


def fetch_sec_filings(tickers_dict: dict) -> list:
    try:
        r = requests.get(
            "https://www.sec.gov/files/company_tickers.json",
            headers={"User-Agent": "REIT Dashboard reit-dashboard@research.com"}, timeout=15
        )
        ticker_cik = {v['ticker'].upper(): str(v['cik_str']).zfill(10) for v in r.json().values()}
    except Exception as e:
        print(f"  EDGAR ticker map failed: {e}", file=sys.stderr)
        return []

    PRIORITY_FORMS = {'10-K', '10-Q'}
    ALL_FORMS = PRIORITY_FORMS | {'8-K'}
    items = []
    for ticker, name in tickers_dict.items():
        cik = ticker_cik.get(ticker.upper())
        if not cik:
            continue
        try:
            r = requests.get(
                f"https://data.sec.gov/submissions/CIK{cik}.json",
                headers={"User-Agent": "REIT Dashboard reit-dashboard@research.com"}, timeout=10
            )
            recent = r.json().get('filings', {}).get('recent', {})
            forms = recent.get('form', [])
            dates = recent.get('filingDate', [])
            accs  = recent.get('accessionNumber', [])
            docs  = recent.get('primaryDocument', [])

            for i, form in enumerate(forms[:80]):
                if form not in ALL_FORMS:
                    continue
                acc  = accs[i].replace('-', '') if i < len(accs) else ''
                doc  = docs[i] if i < len(docs) else ''
                date = dates[i] if i < len(dates) else ''
                link = f"https://www.sec.gov/Archives/edgar/data/{int(cik)}/{acc}/{doc}"
                items.append({
                    "ticker": ticker, "company": name,
                    "source": "SEC EDGAR", "category": "filing",
                    "form": form,
                    "title": f"{ticker} — {form} ({date})",
                    "link": link,
                    "published": date + "T12:00:00Z" if date else "",
                    "summary": f"{name} filed a {form} with the SEC on {date}.",
                    "is_signal": True,
                    "is_priority": form in PRIORITY_FORMS,
                    "is_portfolio": ticker in PORTFOLIO,
                })
            count = sum(1 for x in items if x['ticker'] == ticker)
            print(f"  EDGAR {ticker}: {count} filings")
        except Exception as e:
            print(f"  EDGAR ERROR {ticker}: {e}", file=sys.stderr)

    return items


def generate_weekly_report(stocks: dict, all_news: list) -> dict:
    from datetime import timedelta
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)

    movers = []
    for ticker in PORTFOLIO:
        try:
            hist = yf.Ticker(ticker).history(period="5d").dropna(subset=["Close"])
            if len(hist) >= 2:
                start = float(hist["Close"].iloc[0])
                end   = float(hist["Close"].iloc[-1])
                wpct  = ((end - start) / start * 100) if start else 0
                movers.append({"ticker": ticker, "name": PORTFOLIO[ticker], "price": round(end, 2), "weekly_pct": round(wpct, 2)})
        except Exception:
            pass

    movers.sort(key=lambda x: x["weekly_pct"], reverse=True)
    key_signals, broad_highlights = [], []
    for item in all_news:
        if not item.get("is_signal"):
            continue
        try:
            pub = datetime.fromisoformat(item["published"].replace("Z", "+00:00"))
        except Exception:
            continue
        if pub < one_week_ago:
            continue
        if item.get("ticker") in PORTFOLIO:
            key_signals.append(f"{item['ticker']}: {item['title']}")
        elif item.get("category") in ("broad", "healthcare", "industrial", "housing", "hospitality", "towers", "retail"):
            broad_highlights.append(item["title"])

    return {
        "week_ending":      datetime.now().strftime("%B %d, %Y"),
        "generated_at":     datetime.now(timezone.utc).isoformat(),
        "advancing":        sum(1 for m in movers if m["weekly_pct"] > 0),
        "declining":        sum(1 for m in movers if m["weekly_pct"] < 0),
        "total":            len(movers),
        "top_gainers":      movers[:3],
        "top_losers":       list(reversed(movers[-3:])) if len(movers) >= 3 else movers,
        "key_signals":      key_signals[:10],
        "broad_highlights": broad_highlights[:8],
    }


# ── Sector tags for display ────────────────────────────────────
PORTFOLIO_SECTORS = {
    "CTRE": "Healthcare",
    "MAC":  "Retail — Mall",
    "XHR":  "Hospitality",
    "EPRT": "Net Lease",
    "MRP":  "Land Banking",
    "TRNO": "Industrial",
    "SBAC": "Tower",
}

# ── Thesis data from pitch decks (update quarterly) ───────────
FOCUS_DETAILS = {
    "CTRE": {
        "ticker": "CTRE", "name": "CareTrust REIT", "sector": "Healthcare",
        "exchange": "NASDAQ",
        "key_dates": [
            {"event": "Dividend Payment",  "date": "April 15, 2026",     "note": "$0.39/share — 16.4% hike vs prior quarter"},
            {"event": "Annual Meeting",    "date": "April 29, 2026",     "note": "Director elections, Deloitte auditor ratification"},
            {"event": "Q1 2026 Earnings", "date": "Est. early May 2026", "note": "Watch: deployment pace, FAD/FFO guidance"},
        ],
        "analyst_coverage": [
            {"firm": "Mizuho",   "rating": "Outperform", "target": 42, "date": "Apr 2026"},
            {"firm": "JPMorgan", "rating": "Overweight",  "target": 40, "date": "Mar 2026"},
        ],
        "thesis_points": [
            "Aggressive capital deployer — $1.8B+ invested in 2025, $142M deal announced early 2026",
            "16% dividend hike signals management confidence in pipeline accretion and cash flow visibility",
            "Pure-play SNF/AL focus benefits from CMS 3.2% net rate increase (FY2026) and rising occupancy (~79%→81%)",
            "SNF staffing mandate rollback removes a structural headwind for operators",
            "Mizuho Outperform initiation ($42 PT) expands analyst coverage and adds buy-side visibility",
        ],
        "key_debate": {
            "street":  "Deployment pace may slow; Medicare Advantage expansion pressures operator margins",
            "our_view": "Pipeline remains full; CMS rate increases and staffing relief offset MA headwinds",
        },
        "risks": ["Medicare Advantage expansion", "Capital deployment pace", "Interest rate sensitivity"],
        "peers": ["WELL", "VTR", "OHI"],
    },
    "MAC": {
        "ticker": "MAC", "name": "Macerich", "sector": "Retail — Class A Mall",
        "exchange": "NYSE",
        "key_dates": [
            {"event": "Q1 2026 Earnings", "date": "Est. May 2026",      "note": "Watch: SNO pipeline conversion, Forever 21 re-leasing progress"},
            {"event": "Debt Maturity",    "date": "2026",               "note": "Term loan refinancing — watch spread vs SOFR"},
        ],
        "analyst_coverage": [
            {"firm": "JPMorgan",       "rating": "Overweight",  "target": 22, "date": "Q4 2025"},
            {"firm": "BofA",           "rating": "Neutral",     "target": 18, "date": "Sep 2025"},
            {"firm": "TD Cowen",       "rating": "Outperform",  "target": 24, "date": "Q3 2025"},
        ],
        "thesis_points": [
            "Quality over speed: replacing Forever 21 vacancies (~570K sqft) with experiential anchors at >2x legacy rents",
            "New CEO Jackson Hsieh (ex-Spirit Realty) reduced ND/EBITDA from 10.8x → 7.8x within ~1 year of taking office",
            "Crabtree acquisition: fortress-quality asset at $219/SF vs $261/SF peer, 11% going-in cap rate vs ~7-8% peers",
            "Portfolio moat: 42 Class A malls in prime coastal metros (CA, NY, AZ, NJ, PA), $894/SF go-forward tenant sales",
            "16 consecutive quarters of positive leasing spreads; SNO pipeline $90–140M+; new leases 9% above renewals",
            "Deleveraging roadmap: $6.6B → ~$4.5B debt by 2029–2030, targeting ~6x ND/EBITDA via asset sales",
        ],
        "key_debate": {
            "street":   "High leverage (8.2x vs SPG 5.7x, SKT 5.4x), tenant bankruptcies (Forever 21, Claire's) signal structural decline",
            "our_view": "Occupancy gap is deliberate — quality tenants commanding >2x prior rents. Deleveraging credibly underway with $395M B/C sales in 2025",
        },
        "risks": ["E-commerce / consumer trends", "Financial leverage (8.2x ND/EBITDA)", "Tenant bankruptcies"],
        "peers": ["SPG", "SKT"],
    },
    "XHR": {
        "ticker": "XHR", "name": "Xenia Hotels & Resorts", "sector": "Hospitality",
        "exchange": "NYSE",
        "key_dates": [
            {"event": "Next Earnings", "date": "TBD", "note": "Watch: RevPAR growth, group bookings, margin recovery"},
        ],
        "analyst_coverage": [
            {"firm": "Baird",          "rating": "Outperform", "target": 17, "date": "2025"},
            {"firm": "Deutsche Bank",  "rating": "Buy",        "target": 16, "date": "2025"},
        ],
        "thesis_points": [
            "Upper-upscale, full-service portfolio in prime urban/resort markets with high barriers to entry",
            "Strong group and leisure travel demand recovery drives RevPAR growth above pre-pandemic levels",
            "Asset-light redevelopment pipeline improving property quality without large capex outlays",
            "Sector delivered 31% absolute return as of Spring 2026 report card — top performer in GSIF portfolio",
        ],
        "key_debate": {
            "street":   "Hotel REITs face recession sensitivity and potential RevPAR deceleration in 2026",
            "our_view": "Group booking pace and urban market recovery remain strong; portfolio quality improving",
        },
        "risks": ["Economic slowdown / recession", "RevPAR deceleration", "Rising hotel supply in key markets"],
        "peers": ["PK", "HST"],
    },
    "EPRT": {
        "ticker": "EPRT", "name": "Essential Properties Realty Trust", "sector": "Net Lease",
        "exchange": "NYSE",
        "key_dates": [
            {"event": "Q3 2025 Earnings", "date": "October 23, 2025", "note": "Beats EPS by 5.77%; EquipmentShare (3.5% ABR) alleged fraud"},
            {"event": "Next Earnings",    "date": "Est. May 2026",    "note": "Watch: acquisition pace, car wash ABR trend, AFFO/share guidance"},
        ],
        "analyst_coverage": [
            {"firm": "Deutsche Bank", "rating": "Buy",        "target": 33, "date": "Q3 2025"},
            {"firm": "Barclays",      "rating": "Overweight", "target": 34, "date": "Q3 2025"},
            {"firm": "Mizuho",        "rating": "Buy",        "target": 35, "date": "Q3 2025"},
        ],
        "thesis_points": [
            "Acquisition flywheel: relationship-driven bilateral sourcing → 8.16% cap rate, 18.7yr WALT, 2.2% annual bumps → 10.0% GAAP yield vs peers' 7–8%",
            "88% of H1 2025 deployments came from existing tenants — tenant-growth pipeline, not cyclical opportunism",
            "Tenant risk is overpriced: ZIPS bankruptcy was a balance-sheet failure, not demand destruction; car wash same-store sales resilient through recessions",
            "Portfolio: 2,261 properties, 48 states, 99% occupancy, 51% Sunbelt ABR, 400+ tenants (no one >4% ABR), 3.4x rent coverage",
            "Revenue: 77.6% service-based (car washes, medical/dental, childcare, QSR) — insulated from e-commerce disruption",
            "$250–370M deployed per quarter at ~8% cash cap / ~10% GAAP cap regardless of implied spread noise",
        ],
        "key_debate": {
            "street":   "Unrated middle-market tenants (~97% of deals) are too risky; car wash ~14% ABR introduces cyclical risk after ZIPS bankruptcy",
            "our_view": "Granular diversification (400+ tenants, no one >4% ABR) + 18yr WALT + 2% escalators + master lease protection offset unrated tenant risk. Car wash fears are misunderstood",
        },
        "risks": ["Competitive pressure on cap rates from PE/family offices", "Car wash concentration (~14% ABR)", "Internal funding reliance / equity dilution"],
        "peers": ["O", "NNN", "ADC"],
    },
    "MRP": {
        "ticker": "MRP", "name": "Millrose Properties", "sector": "Land Banking",
        "exchange": "NYSE",
        "key_dates": [
            {"event": "IPO / Spin-off",    "date": "January 2025",       "note": "Spun off from Lennar Corporation"},
            {"event": "Yardly Deal",       "date": "July 23, 2025",      "note": "$3B deal with Taylor Morrison via Kennedy Lewis"},
            {"event": "Next Earnings",     "date": "Est. May 2026",      "note": "Watch: Other Agreements IC growth, option fee %, walkaway count"},
        ],
        "analyst_coverage": [
            {"firm": "Citizens Bank",  "rating": "Outperform", "target": 47, "date": "2025"},
            {"firm": "Citi",           "rating": "Buy",        "target": 44, "date": "Q3 2025"},
            {"firm": "BTIG",           "rating": "Buy",        "target": 43, "date": "Q3 2025"},
        ],
        "thesis_points": [
            "First publicly traded land banking REIT — 876 communities, 139,000 homesites, $8.4B homesite inventory under option",
            "Walkaway risk overplayed: cross-termination pools (97% of invested capital) → max 10% loss per walkaway (5% deposit + 5% fee); 0 walkaways to date",
            "Other Agreements segment growing 3.4x from Q1–Q3 2025 — rapidly diversifying beyond Lennar's ~80% revenue share",
            "IROIC (9.5–10.3%) exceeds WACC; value-accretive at current P/BV of ~0.87x; book value grows as inventory expands",
            "HOPP'R technology platform (centralized land analytics + deal execution) creates a moat difficult to replicate at scale",
            "Consensus analyst: 'Land is land — unless there's a recession, no reason to trade at a discount to book'",
        ],
        "key_debate": {
            "street":   "Lennar concentration risk (80% revenue); limited operating history makes walkaway risk difficult to price; housing macro headwinds",
            "our_view": "Cross-termination pools structurally deter walkaways; Other Agreements rapidly scaling; IROIC > WACC at 1.0x book means equity issuance is accretive",
        },
        "risks": ["Lennar concentration (~80% revenue)", "Builder walkaways (mitigated by cross-term pools)", "Housing macro slowdown"],
        "peers": ["LEN"],
    },
    "TRNO": {
        "ticker": "TRNO", "name": "Terreno Realty", "sector": "Industrial",
        "exchange": "NYSE",
        "key_dates": [
            {"event": "Next Earnings", "date": "TBD", "note": "Watch: same-store NOI, acquisition volume, coastal vacancy rates"},
        ],
        "analyst_coverage": [
            {"firm": "Green Street",  "rating": "Buy",        "target": 72, "date": "2025"},
            {"firm": "Raymond James", "rating": "Outperform", "target": 70, "date": "2025"},
        ],
        "thesis_points": [
            "Concentrated coastal infill strategy — LA, NY, SF, Seattle, Miami, DC — where land supply is structurally constrained",
            "100% industrial focus on last-mile / urban logistics, capturing e-commerce and reshoring tailwinds",
            "Pure acquirer model: no development risk, no construction cost overruns, no lease-up uncertainty",
            "Historically high occupancy (98%+) driven by irreplaceable locations and limited competing supply",
            "Sector delivered 15% absolute return as of Spring 2026 report card",
        ],
        "key_debate": {
            "street":   "Tariff-driven freight slowdown and e-commerce normalization could pressure coastal industrial demand",
            "our_view": "Coastal infill land scarcity creates structural floor on vacancy; last-mile demand accelerates regardless of trade policy",
        },
        "risks": ["Tariff-driven freight slowdown", "E-commerce normalization", "Rising coastal cap rates"],
        "peers": ["PLD", "EGP", "REXR", "STAG"],
    },
    "SBAC": {
        "ticker": "SBAC", "name": "SBA Communications", "sector": "Infrastructure — Tower",
        "exchange": "NASDAQ",
        "key_dates": [
            {"event": "Q4 2025 Earnings", "date": "February 26, 2026",  "note": "AFFO miss + cautious 2026 guidance ex-EchoStar/DISH revenue"},
            {"event": "Sprint Churn Hard Stop", "date": "2026",         "note": "~$55M Sprint churn guided to clear ~2026 → ~$20M tail"},
            {"event": "DISH/EchoStar Churn Clear", "date": "2027–2028", "note": "~$25M annual churn guided to burn off"},
            {"event": "Next Earnings",    "date": "Est. Q1 2026",       "note": "Watch: net organic growth, Brazil FX, T-Mobile churn update"},
        ],
        "analyst_coverage": [
            {"firm": "Wells Fargo",   "rating": "Overweight", "target": 220, "date": "Q4 2025"},
            {"firm": "Morgan Stanley","rating": "Overweight", "target": 215, "date": "Q4 2025"},
            {"firm": "RBC Capital",   "rating": "Outperform", "target": 225, "date": "Q1 2026"},
            {"firm": "Barclays",      "rating": "Overweight", "target": 210, "date": "Q4 2025"},
        ],
        "thesis_points": [
            "P/AFFO compressed -28% over 3 years despite AFFO/share growing +2.24% — fundamental valuation disconnect vs structural durability",
            "Churn inflection: Sprint (~$55M, hard stop ~2026), DISH/EchoStar (~$25M, clears 2027–28), then clean organic growth at 5–6%",
            "Brazil structural opportunity: 58% fewer towers per 100K people vs US; legally binding 5G buildout obligations through 2029",
            "ROIC improved 4.7% → 8.9% (2020–2025), best among tower peers; revenue +35% vs CCI -27% in same period",
            "MLA structure locks in 3% annual domestic escalators + amendment fees on every equipment upgrade ($5–10K each)",
            "46,328 towers across 13 countries; 1.8 tenants/tower domestic (vs CCI 2.4x EU 2.1x) = significant colocation runway",
        ],
        "key_debate": {
            "street":   "Carrier consolidation churn (Sprint, DISH) suppresses organic growth; Brazilian FX and macro headwinds; Q4 guidance miss signals execution risk",
            "our_view": "Churn is front-loaded and quantified — Sprint hard stop ~2026, DISH clears 2027–28. Post-churn organic growth re-accelerates to 5%+. Brazil upside is not in consensus",
        },
        "risks": ["Brazilian macro volatility (BRL/USD, Selic rates)", "Carrier consolidation churn", "Emerging market lease non-renewals"],
        "peers": ["AMT", "CCI"],
    },
}


def main():
    print("=== GSIF REIT Portfolio Dashboard — Data Fetch ===")
    print(f"Run time: {datetime.now(timezone.utc).isoformat()}\n")

    print("Fetching portfolio prices...")
    portfolio_stocks = fetch_prices(PORTFOLIO)

    print("\nFetching peer prices...")
    peer_stocks = fetch_prices(PEERS)

    print("\nFetching REIT news (portfolio + peers)...")
    reit_news = fetch_reit_news()

    print("\nFetching broad sector news...")
    broad_news = fetch_broad_news()

    print("\nFetching NewsAPI...")
    api_news = fetch_newsapi()

    print("\nFetching SEC filings (portfolio only)...")
    sec_news = fetch_sec_filings(PORTFOLIO)

    all_news = tag_signals(reit_news + broad_news + api_news + sec_news)

    # Portfolio movers
    port_sorted = sorted(portfolio_stocks.values(), key=lambda s: s["pct_change"], reverse=True)

    is_sunday = datetime.now().weekday() == 6
    weekly_report = None
    if is_sunday:
        print("\nGenerating weekly report (Sunday)...")
        weekly_report = generate_weekly_report(portfolio_stocks, all_news)
    else:
        out_path = os.path.join(os.path.dirname(__file__), "..", "data", "market_data.json")
        try:
            with open(out_path, "r") as f:
                weekly_report = json.load(f).get("weekly_report")
        except Exception:
            pass

    payload = {
        "last_updated":   datetime.now(timezone.utc).isoformat(),
        "market_date":    datetime.now().strftime("%B %d, %Y"),
        "portfolio":      portfolio_stocks,
        "peers":          peer_stocks,
        "top_gainers":    port_sorted[:3],
        "top_losers":     list(reversed(port_sorted[-3:])) if len(port_sorted) >= 3 else port_sorted,
        "news":           all_news,
        "weekly_report":  weekly_report,
        "focus_details":  FOCUS_DETAILS,
        "portfolio_order": list(PORTFOLIO.keys()),
        "portfolio_sectors": PORTFOLIO_SECTORS,
    }

    out = os.path.join(os.path.dirname(__file__), "..", "data", "market_data.json")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w") as f:
        json.dump(payload, f, indent=2)

    signals = sum(1 for n in all_news if n["is_signal"])
    print(f"\nDone. {len(portfolio_stocks)} portfolio | {len(peer_stocks)} peers | {len(all_news)} news | {signals} signals")


if __name__ == "__main__":
    main()

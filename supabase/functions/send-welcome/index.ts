import { createTransport } from "npm:nodemailer@6";

const GMAIL_USER     = Deno.env.get("GMAIL_USER") ?? "";
const GMAIL_APP_PASS = Deno.env.get("GMAIL_APP_PASS") ?? "";
const SITE_URL       = "https://reedcoene.github.io/Real-Estate-Sector-Portfolio-Dashboard";

const SECTOR_LABELS: Record<string, string> = {
  healthcare: "Healthcare",
  housing:    "Residential",
  industrial: "Industrial",
  retail:     "Retail / Mall",
  hospitality:"Hospitality",
  netlease:   "Net Lease",
  tower:      "Tower",
  office:     "Office",
};

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const { email, sector } = await req.json();
  if (!email || !sector) {
    return new Response("Missing fields", { status: 400 });
  }

  const label = SECTOR_LABELS[sector] ?? sector;

  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif">
<div style="max-width:560px;margin:0 auto;padding:32px 16px 48px">

  <div style="background:#0a0b0d;border-radius:16px 16px 0 0;padding:32px 36px 24px">
    <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:1.2px;color:#578bfa;margin-bottom:8px">REIT Dashboard</div>
    <div style="font-size:26px;font-weight:600;color:#fff;letter-spacing:-.4px">You're subscribed.</div>
    <div style="font-size:14px;color:#6b7280;margin-top:8px">${label} sector &nbsp;·&nbsp; Daily brief</div>
  </div>

  <div style="background:#fff;border-radius:0 0 16px 16px;padding:28px 36px 32px;border:1px solid #eaecf2;border-top:none;margin-bottom:20px">
    <p style="font-size:15px;color:#2e3340;line-height:1.7;margin:0 0 20px">
      Thanks for subscribing to the <strong>${label} REIT Daily Brief</strong>. Starting today, you'll get a market summary in your inbox every weekday at around <strong>4:30 PM ET</strong>, right after market close.
    </p>

    <div style="background:#f8f9fc;border-radius:10px;padding:18px 20px;margin-bottom:24px">
      <div style="font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#9ca3af;margin-bottom:12px">What you'll get each day</div>
      <div style="font-size:13px;color:#4a5060;line-height:2">
        📈 &nbsp;Today's biggest movers<br>
        🏢 &nbsp;Focus stock update &amp; thesis<br>
        📰 &nbsp;Key signals &amp; sector news<br>
        📊 &nbsp;Advances vs. declines across the universe
      </div>
    </div>

    <a href="${SITE_URL}" style="display:inline-block;background:#0052ff;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:13px 26px;border-radius:8px;letter-spacing:-.1px">View Dashboard →</a>
  </div>

  <div style="text-align:center;font-size:11px;color:#9ca3af">
    Not investment advice &nbsp;·&nbsp; Data via yfinance &amp; public feeds
  </div>

</div>
</body>
</html>`;

  const transporter = createTransport({
    service: "gmail",
    auth: { user: GMAIL_USER, pass: GMAIL_APP_PASS },
  });

  await transporter.sendMail({
    from: `REIT Dashboard <${GMAIL_USER}>`,
    to: email,
    subject: `Welcome to the ${label} REIT Daily Brief`,
    html,
  });

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});

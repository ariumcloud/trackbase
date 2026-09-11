import { NextResponse } from "next/server";

export async function GET() {
  try {
    const response = await fetch("https://open.er-api.com/v6/latest/USD", { next: { revalidate: 21600 } });
    if (!response.ok) throw new Error("rate unavailable");
    const data = await response.json();
    if (data.result !== "success" || !data.rates) throw new Error("rate unavailable");
    // Sales can arrive in whatever currency the buyer paid in (Hotmart and
    // other gateways settle internationally), not just the handful this app's
    // UI offers as a display option. Restricting this to a curated list made
    // convertCurrencyAmount() silently fail — and the dashboard silently drop
    // that sale's revenue to R$0 — for any currency outside it. Return every
    // rate the provider has instead of pre-filtering.
    const rates = Object.fromEntries(
      Object.entries(data.rates as Record<string, unknown>)
        .map(([currency, rate]) => [currency, Number(rate)] as const)
        .filter(([currency, rate]) => /^[A-Z]{3}$/.test(currency) && Number.isFinite(rate) && rate > 0),
    );
    return NextResponse.json(
      { rates: { USD: 1, ...rates }, date: data.time_last_update_utc || null },
      { headers: { "Cache-Control": "public, max-age=21600" } },
    );
  } catch {
    return NextResponse.json({ error: "Câmbio indisponível no momento." }, { status: 503 });
  }
}
